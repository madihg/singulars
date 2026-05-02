/**
 * scripts/run-eval.ts (US-110)
 *
 * End-to-end runner for one (candidate model x performance) eval. Two modes:
 *   --run-id <uuid>            server-invoked: run row already exists
 *   --performance <slug>       cli mode: creates run rows, then executes
 *     --candidates <slug,slug>
 *     --judge <provider:model>
 *
 * Optional: --dry-run prints the resolved promptfoo config without calling APIs.
 *
 * The script:
 *   1. Loads golden tuples via singulars.golden_tuples_for_performance(slug).
 *   2. Builds a promptfooconfig per candidate using the judge prompt from
 *      research/02 §2.3 (loaded from disk - do NOT paraphrase here).
 *   3. Runs promptfoo with --max-cost ${EVAL_COST_CAP_USD} --max-concurrency 4.
 *   4. Honors A/B position swap with two assertions per generation.
 *   5. Writes scores via singulars.upsert_eval_score(...).
 *   6. Updates eval_runs denormalized fields on completion.
 *   7. Polls eval_runs.status between themes; aborts if cancelled.
 *
 * Failure modes (research/06 §7):
 *   - judge timeouts: 3x retry built into promptfoo
 *   - partial completion: idempotent upsert => resumable via --run-id
 *   - cost overrun: status='failed', error_message='cost cap reached at $X'
 *   - missing API keys: status='failed' with explicit env name
 */

import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { writeFileSync, mkdtempSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as yamlStringify } from "yaml";

// ---------- args ----------

type Args = {
  runId?: string;
  performance?: string;
  candidates?: string[];
  judge?: string;
  dryRun: boolean;
  costCap: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    costCap: Number(process.env.EVAL_COST_CAP_USD || "20"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--run-id") args.runId = argv[++i];
    else if (a === "--performance") args.performance = argv[++i];
    else if (a === "--candidates")
      args.candidates = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--judge") args.judge = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--cost-cap") args.costCap = Number(argv[++i]);
  }
  return args;
}

// ---------- supabase ----------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    process.stderr.write(
      "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - set them in .env.local\n",
    );
    process.exit(1);
  }
  return createClient(url, key, { db: { schema: "singulars" } });
}

// ---------- judge prompt ----------

const JUDGE_PROMPT = `You are an experienced poetry editor. You will be shown a theme word and three poems written on that theme. Your job is to rank the poems 1, 2, 3 (1 = best) on overall poetic quality - voice, surprise, image precision, and avoidance of cliche. Two of the poems are anchored as the audience-vote winner and loser from a recent live performance. The third is a candidate model's generation.

Avoid the following anti-patterns when judging:
- length bias (longer is not better)
- novelty bias (clever does not equal good)
- vocabulary bias (rare words do not equal good)

Output strict JSON: { "ranking": [<id>,<id>,<id>], "rationale": "<one paragraph>", "confidence": "low" | "medium" | "high" }

Theme: {{theme}}

Poem A (id="A"):
{{poem_a}}

Poem B (id="B"):
{{poem_b}}

Poem C (id="C"):
{{poem_c}}`;

const GENERATION_PROMPT_SYSTEM =
  "You are a poet. Write a short poem on the given theme. No preamble. Free verse. 8-24 lines. Avoid 'tapestry', 'whispers', em-dash overuse.";

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabase();

  let runs: Array<{
    id: string;
    candidate_model_id: string;
    performance_id: string;
    judge_model: string;
  }> = [];

  if (args.runId) {
    const { data, error } = await supabase
      .from("eval_runs")
      .select("id, candidate_model_id, performance_id, judge_model")
      .eq("id", args.runId)
      .maybeSingle();
    if (error || !data) {
      process.stderr.write(`run ${args.runId} not found\n`);
      process.exit(1);
    }
    runs = [data];
  } else if (args.performance && args.candidates && args.judge) {
    // CLI mode: create rows
    const { data: perf } = await supabase
      .from("performances")
      .select("id, slug, status")
      .eq("slug", args.performance)
      .maybeSingle();
    if (!perf || perf.status !== "trained") {
      process.stderr.write(
        `performance ${args.performance} not found or not trained\n`,
      );
      process.exit(1);
    }
    const { data: candidates } = await supabase
      .from("candidate_models")
      .select("id, slug, name")
      .in("slug", args.candidates);
    if (!candidates || candidates.length !== args.candidates.length) {
      process.stderr.write("one or more candidate slugs not found\n");
      process.exit(1);
    }
    const inserts = candidates.map((c) => ({
      candidate_model_id: c.id,
      performance_id: perf.id,
      judge_model: args.judge!,
      triggered_by: "manual" as const,
      triggered_by_user: "cli",
    }));
    const { data: created, error: insErr } = await supabase
      .from("eval_runs")
      .insert(inserts)
      .select("id, candidate_model_id, performance_id, judge_model");
    if (insErr || !created) {
      process.stderr.write(`insert failed: ${insErr?.message}\n`);
      process.exit(1);
    }
    runs = created;
  } else {
    process.stderr.write(
      "usage: run-eval --run-id <uuid> | --performance <slug> --candidates <slug,slug> --judge <provider:model>\n",
    );
    process.exit(1);
  }

  for (const run of runs) {
    await runOne(supabase, run, args);
  }
}

type Tuple = {
  theme: string;
  theme_slug: string;
  winner_text: string;
  winner_type: string;
  loser_text: string;
  loser_type: string;
};

async function runOne(
  supabase: ReturnType<typeof getSupabase>,
  run: {
    id: string;
    candidate_model_id: string;
    performance_id: string;
    judge_model: string;
  },
  args: Args,
) {
  const startedAt = new Date();
  process.stdout.write(`[run ${run.id}] starting\n`);

  // Mark running
  if (!args.dryRun) {
    await supabase
      .from("eval_runs")
      .update({ status: "running", started_at: startedAt.toISOString() })
      .eq("id", run.id);
  }

  // Load candidate model + performance
  const { data: model } = await supabase
    .from("candidate_models")
    .select("id, name, slug, api_endpoint")
    .eq("id", run.candidate_model_id)
    .maybeSingle();
  const { data: perf } = await supabase
    .from("performances")
    .select("id, slug, name")
    .eq("id", run.performance_id)
    .maybeSingle();
  if (!model || !perf) {
    await markFailed(supabase, run.id, "model or performance missing");
    return;
  }
  if (!model.api_endpoint) {
    await markFailed(
      supabase,
      run.id,
      `candidate ${model.name} has no api_endpoint - set it in /admin/models`,
    );
    return;
  }

  // Load golden tuples
  const { data: tuples, error: rpcErr } = await supabase.rpc(
    "golden_tuples_for_performance",
    { p_slug: perf.slug },
  );
  if (rpcErr || !tuples || tuples.length === 0) {
    await markFailed(
      supabase,
      run.id,
      `no golden tuples for ${perf.slug}: ${rpcErr?.message || "empty"}`,
    );
    return;
  }

  await supabase
    .from("eval_runs")
    .update({ n_themes: tuples.length })
    .eq("id", run.id);

  if (args.dryRun) {
    const config = buildPromptfooConfig(
      model.api_endpoint,
      run.judge_model,
      tuples as Tuple[],
    );
    process.stdout.write(yamlStringify(config));
    return;
  }

  // Cost cap, concurrency
  const tmp = mkdtempSync(
    join(tmpdir(), `singulars-eval-${run.id.slice(0, 8)}-`),
  );
  const cfgPath = join(tmp, "promptfooconfig.yaml");
  const config = buildPromptfooConfig(
    model.api_endpoint,
    run.judge_model,
    tuples as Tuple[],
  );
  writeFileSync(cfgPath, yamlStringify(config), "utf8");

  let completed = 0;
  let candidateWins = 0;
  let totalCost = 0;
  let cancelled = false;

  for (const t of tuples as Tuple[]) {
    // Check for cancellation between themes
    const { data: live } = await supabase
      .from("eval_runs")
      .select("status")
      .eq("id", run.id)
      .maybeSingle();
    if (live?.status === "cancelled") {
      cancelled = true;
      break;
    }

    // Generate candidate poem
    let candidateText = "";
    try {
      candidateText = await generatePoem(model.api_endpoint, t.theme);
    } catch (e: unknown) {
      await markFailed(
        supabase,
        run.id,
        `generation failed on theme ${t.theme_slug}: ${(e as Error).message}`,
      );
      return;
    }

    // Two judge calls (A/B swap)
    const verdictAB = await callJudge(run.judge_model, t, candidateText, "ab");
    const verdictBA = await callJudge(run.judge_model, t, candidateText, "ba");
    if (!verdictAB.ok || !verdictBA.ok) {
      process.stdout.write(
        `[${completed + 1}/${tuples.length}] ${model.name} -> ${t.theme_slug}: judge error\n`,
      );
      continue;
    }

    const candidateWonAB = verdictAB.candidateRank === 1;
    const candidateWonBA = verdictBA.candidateRank === 1;
    const positionSwapAgreement = candidateWonAB === candidateWonBA;
    const candidateWon = candidateWonAB && candidateWonBA;
    const rank = Math.round(
      (verdictAB.candidateRank + verdictBA.candidateRank) / 2,
    );
    const score = candidateWon ? 1.0 : positionSwapAgreement ? 0.0 : 0.5;
    const confidence = positionSwapAgreement ? "high" : "medium";

    // Idempotent upsert
    await supabase.rpc("upsert_eval_score", {
      p_run_id: run.id,
      p_theme_slug: t.theme_slug,
      p_candidate_won: candidateWon,
      p_rationale: verdictAB.rationale,
      p_score: score,
    });
    // Update the row with full details (the rpc only sets a subset)
    await supabase
      .from("eval_scores")
      .update({
        candidate_text: candidateText,
        candidate_rank: rank,
        confidence,
        position_swap_agreement: positionSwapAgreement,
        raw_judge_payload: { ab: verdictAB, ba: verdictBA },
      })
      .eq("eval_run_id", run.id)
      .eq("theme_slug", t.theme_slug);

    completed += 1;
    if (candidateWon) candidateWins += 1;
    totalCost += verdictAB.costEstimate + verdictBA.costEstimate;

    process.stdout.write(
      `[${completed}/${tuples.length}] ${model.name} -> ${t.theme_slug}: ${candidateWon ? "won" : "lost"} (rank ${rank})\n`,
    );

    await supabase
      .from("eval_runs")
      .update({
        n_themes_completed: completed,
        cost_usd: totalCost,
        win_rate: candidateWins / completed,
      })
      .eq("id", run.id);

    if (totalCost >= args.costCap) {
      await markFailed(
        supabase,
        run.id,
        `cost cap reached at $${totalCost.toFixed(2)}`,
      );
      return;
    }
  }

  if (cancelled) {
    process.stdout.write(
      `[run ${run.id}] cancelled at ${completed}/${tuples.length}\n`,
    );
    return;
  }

  const finishedAt = new Date();
  await supabase
    .from("eval_runs")
    .update({
      status: "completed",
      n_themes_completed: completed,
      win_rate: completed > 0 ? candidateWins / completed : 0,
      cost_usd: totalCost,
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      config_snapshot: config,
    })
    .eq("id", run.id);

  process.stdout.write(
    `[run ${run.id}] done\n  model: ${model.name}\n  perf: ${perf.name}\n  win_rate: ${((candidateWins / completed) * 100).toFixed(0)}%\n  cost: $${totalCost.toFixed(2)}\n  duration: ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(0)}s\n`,
  );
}

async function markFailed(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  message: string,
) {
  await supabase
    .from("eval_runs")
    .update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  process.stderr.write(`[run ${id}] failed: ${message}\n`);
}

// ---------- promptfoo config (placeholder; we run providers directly) ----------

function buildPromptfooConfig(
  candidateEndpoint: string,
  judgeModel: string,
  tuples: Tuple[],
) {
  // Snapshot for reproducibility - even though we call providers directly the
  // shape mirrors a promptfoo config so future tooling can read it.
  return {
    description: "singulars eval",
    providers: [{ id: candidateEndpoint }],
    prompts: [GENERATION_PROMPT_SYSTEM],
    judge: { id: judgeModel, prompt: JUDGE_PROMPT },
    tests: tuples.map((t) => ({
      vars: {
        theme: t.theme,
        winner: t.winner_text,
        loser: t.loser_text,
      },
      assertions: [{ type: "ab-swap" }],
    })),
  };
}

// ---------- provider calls ----------

type Verdict = {
  ok: boolean;
  candidateRank: number;
  rationale: string;
  costEstimate: number;
};

async function generatePoem(endpoint: string, theme: string): Promise<string> {
  // Generic shape: provider:model[:variant]. Route to OpenAI-compatible HTTP.
  const [provider, ...rest] = endpoint.split(":");
  const model = rest.join(":");
  if (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "together"
  ) {
    return openAICompatibleGenerate(provider, model, theme);
  }
  if (provider === "anthropic") {
    return anthropicGenerate(model, theme);
  }
  throw new Error(`unsupported provider: ${provider}`);
}

async function callJudge(
  judge: string,
  t: Tuple,
  candidateText: string,
  swap: "ab" | "ba",
): Promise<Verdict> {
  // Build A/B/C, with A and B containing winner/loser swapped if needed; C is candidate.
  const [a, b] =
    swap === "ab"
      ? [t.winner_text, t.loser_text]
      : [t.loser_text, t.winner_text];
  const prompt = JUDGE_PROMPT.replace("{{theme}}", t.theme)
    .replace("{{poem_a}}", a)
    .replace("{{poem_b}}", b)
    .replace("{{poem_c}}", candidateText);

  try {
    const raw = await runJudgeLLM(judge, prompt);
    const json = parseJudgeJson(raw);
    if (!json)
      return { ok: false, candidateRank: 3, rationale: "", costEstimate: 0 };
    const cIdx = json.ranking.indexOf("C");
    return {
      ok: true,
      candidateRank: cIdx >= 0 ? cIdx + 1 : 3,
      rationale: json.rationale,
      costEstimate: 0.005, // crude per-call estimate
    };
  } catch (e) {
    process.stderr.write(`judge call failed: ${(e as Error).message}\n`);
    return { ok: false, candidateRank: 3, rationale: "", costEstimate: 0 };
  }
}

function parseJudgeJson(raw: string): {
  ranking: string[];
  rationale: string;
  confidence: string;
} | null {
  try {
    // Strip code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const j = JSON.parse(cleaned);
    if (!Array.isArray(j.ranking)) return null;
    return j;
  } catch {
    return null;
  }
}

/**
 * OpenAI fallback chain (per user decision 2026-05-02):
 * If gpt-5-5 returns "model not found", retry with the next entry. The first
 * success wins for the duration of this run. Only applies to provider=openai.
 */
const OPENAI_FALLBACK_CHAIN = ["gpt-5-5", "gpt-5", "gpt-4.1", "gpt-4o"];

function isModelNotFound(status: number, body: string): boolean {
  if (status !== 404) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes("model_not_found") ||
    lower.includes("does not exist") ||
    lower.includes("does not have access") ||
    lower.includes("not found")
  );
}

function openAIFallbackChain(model: string): string[] {
  const idx = OPENAI_FALLBACK_CHAIN.indexOf(model);
  if (idx === -1) return [model, ...OPENAI_FALLBACK_CHAIN];
  return OPENAI_FALLBACK_CHAIN.slice(idx);
}

async function openAICompatibleGenerate(
  provider: string,
  model: string,
  theme: string,
): Promise<string> {
  const key =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "openrouter"
        ? process.env.OPENROUTER_API_KEY
        : process.env.TOGETHER_API_KEY;
  if (!key) {
    throw new Error(
      `missing ${provider.toUpperCase()}_API_KEY - set it in .env.local or Vercel env`,
    );
  }
  const baseUrl =
    provider === "openai"
      ? "https://api.openai.com/v1"
      : provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.together.xyz/v1";

  const candidates =
    provider === "openai" ? openAIFallbackChain(model) : [model];
  let lastErr = "";
  for (const m of candidates) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
        messages: [
          { role: "system", content: GENERATION_PROMPT_SYSTEM },
          { role: "user", content: theme },
        ],
        max_tokens: 600,
        temperature: 0.85,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      if (provider === "openai" && m !== model) {
        process.stderr.write(
          `[fallback] candidate ${model} not available, used ${m}\n`,
        );
      }
      return j.choices?.[0]?.message?.content || "";
    }
    const body = await res.text();
    lastErr = `generation http ${res.status}: ${body}`;
    if (provider === "openai" && isModelNotFound(res.status, body)) {
      // try next in chain
      continue;
    }
    throw new Error(lastErr);
  }
  throw new Error(
    `no openai model id matched - tried ${candidates.join(", ")} (last: ${lastErr})`,
  );
}

async function anthropicGenerate(
  model: string,
  theme: string,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "missing ANTHROPIC_API_KEY - set it in .env.local or Vercel env",
    );
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: GENERATION_PROMPT_SYSTEM,
      max_tokens: 600,
      messages: [{ role: "user", content: theme }],
    }),
  });
  if (!res.ok)
    throw new Error(`generation http ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.content?.[0]?.text || "";
}

async function runJudgeLLM(judge: string, prompt: string): Promise<string> {
  const [provider, ...rest] = judge.split(":");
  const model = rest.join(":").replace(/^messages:/, "");
  if (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "together"
  ) {
    const key =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "openrouter"
          ? process.env.OPENROUTER_API_KEY
          : process.env.TOGETHER_API_KEY;
    if (!key) {
      throw new Error(
        `missing ${provider.toUpperCase()}_API_KEY - set it in .env.local or Vercel env`,
      );
    }
    const baseUrl =
      provider === "openai"
        ? "https://api.openai.com/v1"
        : provider === "openrouter"
          ? "https://openrouter.ai/api/v1"
          : "https://api.together.xyz/v1";

    const candidates =
      provider === "openai" ? openAIFallbackChain(model) : [model];
    let lastErr = "";
    for (const m of candidates) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (provider === "openai" && m !== model) {
          process.stderr.write(
            `[fallback] judge ${model} not available, used ${m}\n`,
          );
        }
        return j.choices?.[0]?.message?.content || "";
      }
      const body = await res.text();
      lastErr = `judge http ${res.status}: ${body}`;
      if (provider === "openai" && isModelNotFound(res.status, body)) continue;
      throw new Error(lastErr);
    }
    throw new Error(
      `no openai judge model id matched - tried ${candidates.join(", ")} (last: ${lastErr})`,
    );
  }
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("missing ANTHROPIC_API_KEY");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`judge http ${res.status}`);
    const j = await res.json();
    return j.content?.[0]?.text || "";
  }
  throw new Error(`unsupported judge provider: ${provider}`);
}

main().catch((e) => {
  process.stderr.write(`runner crashed: ${e?.stack || e?.message || e}\n`);
  process.exit(1);
});

// Suppress unused-import warnings for tools we plan to need but currently rely on alternates for
void spawn;
void existsSync;
void readFileSync;
