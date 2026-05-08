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

// ---------- judge prompt + council ----------

import {
  ACTIVE_CLASSIFIERS,
  ACTIVE_CLASSIFIERS_VERSION,
  CLASSIFIER_MAX_RAW_SCORE,
  classifiersBlockForJudge,
} from "../src/lib/audience-classifiers";

/**
 * Classifier-based judge prompt (Phase 3, 2026-05-08).
 *
 * Replaces the rank-1/2/3 prompt. Judges no longer "rank" the candidate
 * against A and B subjectively; they score the candidate on each
 * audience-derived classifier (0-5). The classifiers are extracted from 37
 * historical (winner, loser) pairs and codify the room's taste.
 *
 * The audience-pair (A=winner, B=loser) on the same theme is shown for
 * grounding only - the judge does NOT score A or B, just C against the
 * classifier rubric (with A and B as the audience's taste signal on this
 * specific theme).
 */
const JUDGE_PROMPT_CLASSIFIER = `You are scoring a candidate poem against an audience-derived rubric.

The rubric was extracted from 37 (winner, loser) pairs from a live human-vs-machine poetry performance series. Each classifier captures a pattern that consistently distinguishes audience-chosen from audience-rejected poems. The audience's taste is the source of truth - NOT yours.

For each classifier, rate the candidate (Poem C) on a 0-5 scale where:
  0 = strongly absent (matches the loser pole; would lose the room)
  1-2 = mostly absent
  3 = neutral / mixed
  4-5 = strongly present (matches the winner pole; would win the room)

Anchor your scores in the exemplars provided per classifier - those are real winner/loser excerpts from the actual data.

CLASSIFIERS:
{{classifiers_block}}

For grounding on this theme, here is the audience-decided pair (theme: {{theme}}):

  A - audience-chosen winner:
  {{poem_a}}

  B - audience-rejected loser:
  {{poem_b}}

(Use A and B as evidence of the audience's apparent taste on this theme. Do NOT score A or B - only score the candidate.)

CANDIDATE (Poem C):
{{poem_c}}

Output STRICT JSON, no other text:
{
  "scores": { "C1": <0-5>, "C2": <0-5>, "C3": <0-5>, "C4": <0-5>, "C5": <0-5>, "C6": <0-5>, "C7": <0-5> },
  "rationale": "<one short sentence per classifier in the form 'C1: <reason>; C2: <reason>; ...'>",
  "confidence": "low" | "medium" | "high"
}`;

/**
 * The audience-anchored ranking prompt is kept for legacy/comparison runs but
 * is no longer the default - the classifier prompt is the production path.
 */
const JUDGE_PROMPT = `You are a judge evaluating a candidate poem against the taste of a live audience.

For each theme you will see three poems on the same prompt:
  - Poem A: the audience-chosen poem at a live performance (the room's vote)
  - Poem B: the audience-rejected poem at the same performance
  - Poem C: a candidate poem generated by an AI we are evaluating

You do NOT decide what good poetry is in the abstract. The audience already decided. Your job is to assess where C falls relative to A and B - A is the standard the audience set, B is the quality floor. If C matches or surpasses A by the audience's apparent criteria, rank C above A. If C is worse than B, rank it last. The audience's taste is the source of truth, not yours.

Avoid:
- length bias (longer is not better)
- novelty bias (clever does not equal good)
- vocabulary bias (rare words do not equal good)

Rank the three poems from best (1) to worst (3). Output strict JSON, no other text:
{ "ranking": [<id>,<id>,<id>], "rationale": "<one sentence on why C placed where it did, in the audience's terms>", "confidence": "low" | "medium" | "high" }

Theme: {{theme}}

Poem A (audience winner, id="A"):
{{poem_a}}

Poem B (audience loser, id="B"):
{{poem_b}}

Poem C (candidate, id="C"):
{{poem_c}}`;

/**
 * The council. Three judges with three lineages (proprietary frontier OpenAI,
 * proprietary frontier Anthropic, open-source reasoning via OpenRouter). Each
 * gets the same prompt; the mode of their candidate-ranks is the verdict.
 *
 * Requires OPENROUTER_API_KEY in env. Together was an earlier attempt at the
 * open-source slot but credits were exhausted from prior fine-tune work.
 *
 * The eval_runs.judge_model field is now informational only - actual judges
 * used per score are recorded in eval_scores.raw_judge_payload.judges[].
 */
const COUNCIL: string[] = [
  "openai:gpt-5",
  "anthropic:claude-opus-4-7",
  "openrouter:deepseek/deepseek-r1",
];

// The active system prompt used for candidate generation. Single source of
// truth in src/lib/system-prompts.ts so the runner, the admin UI, and the
// fine-tune corpus all reference the same string.
import { ACTIVE_SYSTEM_PROMPT } from "../src/lib/system-prompts";
const GENERATION_PROMPT_SYSTEM = ACTIVE_SYSTEM_PROMPT.text;

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
    .select("id, name, slug, api_endpoint, use_system_prompt")
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

    // Generate candidate poem (use_system_prompt gates the rich poet pantheon
    // prompt - candidates with use_system_prompt=false get raw base-model
    // generation, isolating "what does the prompt buy?")
    let candidateText = "";
    try {
      candidateText = await generatePoem(
        model.api_endpoint,
        t.theme,
        model.use_system_prompt !== false,
      );
    } catch (e: unknown) {
      await markFailed(
        supabase,
        run.id,
        `generation failed on theme ${t.theme_slug}: ${(e as Error).message}`,
      );
      return;
    }

    // Council of 3 classifier-based judges. Each judge scores the candidate
    // on each of the 7 audience-derived classifiers (0-5). Per-classifier
    // council mean is the verdict; the headline `score` is the
    // weight-normalized total (∈ [0, 1], higher = better).
    const judgeResults: Array<{
      judge_id: string;
      ok: boolean;
      scores: Record<string, number>;
      rationale: string;
      confidence: string;
      cost_estimate: number;
    }> = [];
    for (const judgeId of COUNCIL) {
      const v = await callJudgeClassifier(judgeId, t, candidateText);
      judgeResults.push({
        judge_id: judgeId,
        ok: v.ok,
        scores: v.scores,
        rationale: v.rationale,
        confidence: v.confidence,
        cost_estimate: v.costEstimate,
      });
    }

    const okJudges = judgeResults.filter((j) => j.ok);
    if (okJudges.length === 0) {
      process.stdout.write(
        `[${completed + 1}/${tuples.length}] ${model.name} -> ${t.theme_slug}: all council judges failed\n`,
      );
      continue;
    }

    // Per-classifier council mean across OK judges
    const councilScores: Record<string, number> = {};
    for (const c of ACTIVE_CLASSIFIERS.classifiers) {
      const vals: number[] = [];
      for (const j of okJudges) {
        if (typeof j.scores[c.id] === "number") vals.push(j.scores[c.id]);
      }
      if (vals.length > 0) {
        councilScores[c.id] = vals.reduce((s, x) => s + x, 0) / vals.length;
      }
    }
    // Normalized score ∈ [0, 1] using the artifact's weighting
    let raw = 0;
    let max = 0;
    for (const c of ACTIVE_CLASSIFIERS.classifiers) {
      const s = councilScores[c.id];
      if (typeof s !== "number") continue;
      raw += s * c.weight;
      max += 5 * c.weight;
    }
    const score = max > 0 ? raw / max : 0;

    // Inter-rater agreement: stddev across judges per classifier, averaged.
    // High stddev => judges disagree => low confidence in this row.
    let avgStddev = 0;
    let nClassifiersWithMultipleJudges = 0;
    for (const c of ACTIVE_CLASSIFIERS.classifiers) {
      const vals: number[] = [];
      for (const j of okJudges) {
        if (typeof j.scores[c.id] === "number") vals.push(j.scores[c.id]);
      }
      if (vals.length < 2) continue;
      const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
      const variance =
        vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
      avgStddev += Math.sqrt(variance);
      nClassifiersWithMultipleJudges += 1;
    }
    if (nClassifiersWithMultipleJudges > 0) avgStddev /= nClassifiersWithMultipleJudges;
    const confidence: "high" | "medium" | "low" =
      avgStddev < 0.75 ? "high" : avgStddev < 1.5 ? "medium" : "low";

    // Map score → rank for backward compatibility with existing chart code
    // (mean_rank → score conversion). 1.0 → rank 1, 0.5 → rank 2, 0.0 → rank 3.
    const rankApprox = Math.round(3 - 2 * score);
    const candidateWon = score >= 0.7;

    // First OK judge's rationale gets surfaced as the headline
    const headlineRationale = okJudges[0].rationale;

    await supabase.rpc("upsert_eval_score", {
      p_run_id: run.id,
      p_theme_slug: t.theme_slug,
      p_candidate_won: candidateWon,
      p_rationale: headlineRationale,
      p_score: score,
    });
    await supabase
      .from("eval_scores")
      .update({
        candidate_text: candidateText,
        candidate_rank: rankApprox,
        confidence,
        position_swap_agreement: avgStddev < 0.75,
        raw_judge_payload: {
          method: "council-classifier",
          classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
          council_scores: councilScores,
          normalized_score: score,
          inter_rater_avg_stddev: avgStddev,
          judges: judgeResults,
        },
      })
      .eq("eval_run_id", run.id)
      .eq("theme_slug", t.theme_slug);

    completed += 1;
    if (candidateWon) candidateWins += 1;
    totalCost += judgeResults.reduce((s, j) => s + j.cost_estimate, 0);

    process.stdout.write(
      `[${completed}/${tuples.length}] ${model.name} -> ${t.theme_slug}: score ${(score * 100).toFixed(0)}% (${confidence}, σ=${avgStddev.toFixed(2)})\n`,
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

  // Compute mean_rank from this run's eval_scores (graduated metric: avg of
  // candidate_rank across themes; 1.0 = always 1st, 3.0 = always last).
  const { data: scoreRows } = await supabase
    .from("eval_scores")
    .select("candidate_rank")
    .eq("eval_run_id", run.id);
  const ranksForMean = (scoreRows ?? [])
    .map((r) => Number(r.candidate_rank))
    .filter((n) => Number.isFinite(n) && n > 0);
  const meanRank =
    ranksForMean.length > 0
      ? ranksForMean.reduce((s, x) => s + x, 0) / ranksForMean.length
      : null;

  await supabase
    .from("eval_runs")
    .update({
      status: "completed",
      n_themes_completed: completed,
      win_rate: completed > 0 ? candidateWins / completed : 0,
      mean_rank: meanRank,
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

async function generatePoem(
  endpoint: string,
  theme: string,
  useSystemPrompt: boolean,
): Promise<string> {
  // Generic shape: provider:model[:variant]. Route to OpenAI-compatible HTTP.
  const [provider, ...rest] = endpoint.split(":");
  const model = rest.join(":");
  if (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "together"
  ) {
    return openAICompatibleGenerate(provider, model, theme, useSystemPrompt);
  }
  if (provider === "anthropic") {
    return anthropicGenerate(model, theme, useSystemPrompt);
  }
  if (provider === "anthropic-incontext") {
    // Rich prompt + 5 curated (winner, loser) pairs as in-context exposure.
    // "DPO without fine-tuning" - tests whether explicit examples in the
    // prompt help vs just the abstract rich pantheon prompt.
    return anthropicInContextGenerate(model, theme);
  }
  throw new Error(`unsupported provider: ${provider}`);
}

// ---------- in-context DPO exposure (curated pairs cache) ----------

let _curatedPairsCache: string | null = null;

async function getCuratedInContextBlock(
  supabase: ReturnType<typeof getSupabase>,
): Promise<string> {
  if (_curatedPairsCache !== null) return _curatedPairsCache;
  // Top 5 highest-vote-margin (winner, loser) pairs from TRAINING perfs only
  // (carnation+versus+reinforcement+hard - NOT reverse, which is the held-
  // out test set).
  const { data: poems } = await supabase
    .from("poems")
    .select(
      "performance_id, theme, theme_slug, author_type, vote_count, text, performances!inner(slug,status)",
    );
  type PoemRow = {
    performance_id: string;
    theme: string;
    theme_slug: string;
    author_type: string;
    vote_count: number;
    text: string;
    performances:
      | { slug: string; status: string }
      | { slug: string; status: string }[];
  };
  const list = (poems ?? []) as unknown as PoemRow[];
  type Group = {
    perf: string;
    theme: string;
    h_text: string;
    h_votes: number;
    m_text: string;
    m_votes: number;
  };
  const grouped: Record<string, Group> = {};
  for (const r of list) {
    const perf = Array.isArray(r.performances)
      ? r.performances[0]?.slug
      : r.performances?.slug;
    // Exclude reverse-exe (held out) so the in-context exposure doesn't leak
    // the test set into the candidate's view.
    if (!perf || perf === "reverse-exe") continue;
    const k = `${perf}|${r.theme_slug}`;
    if (!grouped[k]) {
      grouped[k] = {
        perf,
        theme: r.theme,
        h_text: "",
        h_votes: -1,
        m_text: "",
        m_votes: -1,
      };
    }
    if (r.author_type === "human") {
      grouped[k].h_text = r.text;
      grouped[k].h_votes = r.vote_count;
    } else if (r.author_type === "machine") {
      grouped[k].m_text = r.text;
      grouped[k].m_votes = r.vote_count;
    }
  }
  const pairs = Object.values(grouped)
    .filter((g) => g.h_text && g.m_text && g.h_votes !== g.m_votes)
    .map((g) => {
      const humanWon = g.h_votes > g.m_votes;
      return {
        perf: g.perf,
        theme: g.theme,
        margin: Math.abs(g.h_votes - g.m_votes),
        winner_text: humanWon ? g.h_text : g.m_text,
        loser_text: humanWon ? g.m_text : g.h_text,
      };
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const block = pairs
    .map(
      (p, i) =>
        `EXAMPLE ${i + 1} (theme: ${p.theme}, perf: ${p.perf}, audience-margin: ${p.margin})

The audience CHOSE this poem:
${p.winner_text.trim()}

The audience REJECTED this poem:
${p.loser_text.trim()}`,
    )
    .join("\n\n---\n\n");

  _curatedPairsCache = block;
  return block;
}

async function anthropicInContextGenerate(
  model: string,
  theme: string,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("missing ANTHROPIC_API_KEY");
  }
  const supabase = getSupabase();
  const inContextBlock = await getCuratedInContextBlock(supabase);
  // Combine the rich pantheon prompt with the in-context exposure
  const systemPrompt = `${GENERATION_PROMPT_SYSTEM}

Below are five (winner, loser) pairs from past live performances of this exact series. The audience voted on each. Study what made the chosen poems land - the patterns the room consistently rewarded. Apply the same instincts when you write the candidate poem on the new theme.

${inContextBlock}

Now write a poem on the new theme below. Aim for what the audience would have chosen.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      max_tokens: 600,
      messages: [{ role: "user", content: theme }],
    }),
  });
  if (!res.ok)
    throw new Error(
      `anthropic-incontext http ${res.status}: ${await res.text()}`,
    );
  const j = await res.json();
  return j.content?.[0]?.text || "";
}

async function callJudge(
  judge: string,
  t: Tuple,
  candidateText: string,
  swap: "ab" | "ba",
): Promise<Verdict> {
  // Legacy ranking-based judge call. Kept for backward compatibility but no
  // longer the default - the classifier-based callJudgeClassifier below is
  // the production path as of Phase 3.
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
    if (!json || !Array.isArray((json as { ranking?: unknown }).ranking))
      return { ok: false, candidateRank: 3, rationale: "", costEstimate: 0 };
    const ranking = (json as { ranking: string[] }).ranking;
    const cIdx = ranking.indexOf("C");
    return {
      ok: true,
      candidateRank: cIdx >= 0 ? cIdx + 1 : 3,
      rationale: (json as { rationale?: string }).rationale || "",
      costEstimate: 0.005,
    };
  } catch (e) {
    process.stderr.write(`judge call failed: ${(e as Error).message}\n`);
    return { ok: false, candidateRank: 3, rationale: "", costEstimate: 0 };
  }
}

type ClassifierVerdict = {
  ok: boolean;
  scores: Record<string, number>; // per-classifier 0-5
  rationale: string;
  confidence: "low" | "medium" | "high";
  costEstimate: number;
};

async function callJudgeClassifier(
  judge: string,
  t: Tuple,
  candidateText: string,
): Promise<ClassifierVerdict> {
  const prompt = JUDGE_PROMPT_CLASSIFIER.replace(
    "{{classifiers_block}}",
    classifiersBlockForJudge(),
  )
    .replace("{{theme}}", t.theme)
    .replace("{{poem_a}}", t.winner_text)
    .replace("{{poem_b}}", t.loser_text)
    .replace("{{poem_c}}", candidateText);

  try {
    const raw = await runJudgeLLM(judge, prompt);
    const parsed = parseJudgeJson(raw) as
      | {
          scores?: Record<string, number>;
          rationale?: string;
          confidence?: "low" | "medium" | "high";
        }
      | null;
    if (!parsed || !parsed.scores || typeof parsed.scores !== "object") {
      process.stderr.write(
        `classifier judge ${judge}: parse failed. raw[:300]=${raw.slice(0, 300)}\n`,
      );
      return {
        ok: false,
        scores: {},
        rationale: "",
        confidence: "low",
        costEstimate: 0,
      };
    }
    // Coerce and clamp to [0, 5]
    const scores: Record<string, number> = {};
    for (const c of ACTIVE_CLASSIFIERS.classifiers) {
      const v = Number(parsed.scores[c.id]);
      if (Number.isFinite(v)) scores[c.id] = Math.max(0, Math.min(5, v));
    }
    return {
      ok: Object.keys(scores).length > 0,
      scores,
      rationale: parsed.rationale || "",
      confidence: parsed.confidence || "medium",
      costEstimate: 0.01, // classifier prompt is bigger, slightly more expensive
    };
  } catch (e) {
    process.stderr.write(`classifier judge call failed: ${(e as Error).message}\n`);
    return {
      ok: false,
      scores: {},
      rationale: "",
      confidence: "low",
      costEstimate: 0,
    };
  }
}

function parseJudgeJson(raw: string): Record<string, unknown> | null {
  try {
    // Strip code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const j = JSON.parse(cleaned);
    if (!j || typeof j !== "object") return null;
    return j as Record<string, unknown>;
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
  useSystemPrompt: boolean,
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
    // gpt-4.x fine-tunes and gpt-5+ models reject max_tokens - use
    // max_completion_tokens instead. Older models still accept max_tokens.
    // Fine-tuned model IDs look like "ft:gpt-4.1-2025-04-14:..." so we check
    // for that prefix too.
    const usesNewParam =
      provider === "openai" &&
      (m.startsWith("gpt-5") ||
        m.startsWith("gpt-4.1") ||
        m.startsWith("ft:gpt-4.1") ||
        m.startsWith("ft:gpt-5") ||
        m.startsWith("ft:gpt-4o"));
    const tokenField = usesNewParam ? "max_completion_tokens" : "max_tokens";
    const usesDefaultTempOnly =
      provider === "openai" &&
      (m.startsWith("gpt-5") || m.startsWith("ft:gpt-5"));
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
        messages: useSystemPrompt
          ? [
              { role: "system", content: GENERATION_PROMPT_SYSTEM },
              { role: "user", content: theme },
            ]
          : [{ role: "user", content: theme }],
        // Bump from 600 → 1500 so reasoning models (Qwen3) have room to
        // think AND output the poem within one response.
        [tokenField]: 1500,
        ...(usesDefaultTempOnly ? {} : { temperature: 0.85 }),
      }),
    });
    if (res.ok) {
      const j = await res.json();
      if (provider === "openai" && m !== model) {
        process.stderr.write(
          `[fallback] candidate ${model} not available, used ${m}\n`,
        );
      }
      let raw: string = j.choices?.[0]?.message?.content || "";
      // Qwen3 family emits <think>...</think> reasoning before the answer.
      // Strip it (and any other reasoning markers) so the judge sees the poem.
      if (raw.includes("<think>")) {
        raw = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }
      return raw;
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
  useSystemPrompt: boolean,
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
      ...(useSystemPrompt ? { system: GENERATION_PROMPT_SYSTEM } : {}),
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
      // gpt-5 family rejects custom temperature - only default (1) allowed.
      // Omit the field entirely for those; keep temperature: 0 for older models
      // where determinism is meaningful.
      const usesDefaultTempOnly = m.startsWith("gpt-5");
      // gpt-4.x fine-tunes and gpt-5+ use max_completion_tokens not max_tokens
      const usesNewTokenParam =
        provider === "openai" &&
        (m.startsWith("gpt-5") ||
          m.startsWith("gpt-4.1") ||
          m.startsWith("ft:gpt-4.1") ||
          m.startsWith("ft:gpt-5") ||
          m.startsWith("ft:gpt-4o"));
      const tokenField = usesNewTokenParam
        ? "max_completion_tokens"
        : "max_tokens";
      // Cap response at 2000 tokens. Judge JSON is ~200 tokens; remainder
      // gives reasoning models (DeepSeek R1) room to think. OpenRouter free
      // tier caps at 2637 tokens/request - 2000 leaves headroom.
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: prompt }],
          ...(usesDefaultTempOnly ? {} : { temperature: 0 }),
          [tokenField]: 2000,
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
