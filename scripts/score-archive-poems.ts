/**
 * scripts/score-archive-poems.ts
 *
 * Retroactive classifier scoring of all archived (Halim + machine) poems
 * across trained performances. Powers the "machine quality trajectory" chart
 * on /evolution - shows whether both authors have improved on
 * audience-taste dimensions across the series, independent of who won the
 * live vote.
 *
 * Idempotent: skips poems already scored at the current
 * ACTIVE_CLASSIFIERS_VERSION. Run again after each new performance to
 * extend the trajectory.
 *
 * Uses a STANDALONE variant of the classifier prompt (no per-theme
 * audience-pair grounding) because the poem we're scoring IS one of those
 * pair members - using the pair as anchors would be circular. The
 * classifier rubric's cross-theme exemplars provide grounding instead.
 *
 * Run: `set -a && source .env.local && set +a && npx tsx scripts/score-archive-poems.ts`
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVE_CLASSIFIERS,
  ACTIVE_CLASSIFIERS_VERSION,
  classifiersBlockForJudge,
  computeClassifierScore,
} from "../src/lib/audience-classifiers";

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    process.stderr.write(
      "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n",
    );
    process.exit(1);
  }
  return createClient(url, key, {
    db: { schema: "singulars" },
  }) as unknown as SupabaseClient;
}

const COUNCIL: string[] = [
  "openai:gpt-5",
  "anthropic:claude-opus-4-7",
  "openrouter:deepseek/deepseek-r1",
];

const JUDGE_PROMPT_STANDALONE = `You are scoring a single poem against an audience-derived rubric.

The rubric was extracted from 37 (winner, loser) pairs from a live human-vs-machine poetry performance series. Each classifier captures a pattern that consistently distinguishes audience-chosen from audience-rejected poems. The audience's taste is the source of truth - NOT yours.

Score the poem on each classifier on a 0-5 scale where:
  0 = strongly absent (matches the loser pole; would lose the room)
  1-2 = mostly absent
  3 = neutral / mixed
  4-5 = strongly present (matches the winner pole; would win the room)

Anchor your scores in the exemplars provided per classifier - those are real winner/loser excerpts from the actual audience-decided data.

CLASSIFIERS:
{{classifiers_block}}

POEM (theme: {{theme}}):
{{poem}}

Output STRICT JSON, no other text:
{
  "scores": { "C1": <0-5>, "C2": <0-5>, "C3": <0-5>, "C4": <0-5>, "C5": <0-5>, "C6": <0-5>, "C7": <0-5> },
  "rationale": "<one short sentence per classifier in the form 'C1: <reason>; C2: <reason>; ...'>",
  "confidence": "low" | "medium" | "high"
}`;

// --------- OpenAI / Anthropic / OpenRouter judge call (mirrors run-eval.ts) ---------

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

async function callJudge(
  judge: string,
  prompt: string,
): Promise<string> {
  const [provider, ...rest] = judge.split(":");
  const model = rest.join(":");
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
    if (!key) throw new Error(`missing ${provider.toUpperCase()}_API_KEY`);
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
      const usesDefaultTempOnly = m.startsWith("gpt-5");
      const usesNewTokenParam =
        provider === "openai" &&
        (m.startsWith("gpt-5") ||
          m.startsWith("gpt-4.1") ||
          m.startsWith("ft:gpt-4.1") ||
          m.startsWith("ft:gpt-5") ||
          m.startsWith("ft:gpt-4o"));
      const tokenField = usesNewTokenParam ? "max_completion_tokens" : "max_tokens";
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
        return j.choices?.[0]?.message?.content || "";
      }
      const body = await res.text();
      lastErr = `${res.status}: ${body}`;
      if (provider === "openai" && isModelNotFound(res.status, body)) continue;
      throw new Error(`judge http ${lastErr}`);
    }
    throw new Error(`no openai model matched: ${lastErr}`);
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`judge http ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return j.content?.[0]?.text || "";
  }
  throw new Error(`unsupported judge provider: ${provider}`);
}

function parseJudgeJson(raw: string): Record<string, unknown> | null {
  try {
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

// --------- main ---------

type ArchivePoem = {
  id: string;
  perf_slug: string;
  theme: string;
  theme_slug: string;
  author_type: string;
  text: string;
};

async function scorePoem(poem: ArchivePoem): Promise<{
  scores: Record<string, number>;
  council: Array<{
    judge_id: string;
    ok: boolean;
    scores: Record<string, number>;
    rationale: string;
  }>;
  stddev: number;
} | null> {
  const prompt = JUDGE_PROMPT_STANDALONE.replace(
    "{{classifiers_block}}",
    classifiersBlockForJudge(),
  )
    .replace("{{theme}}", poem.theme)
    .replace("{{poem}}", poem.text);

  const council: Array<{
    judge_id: string;
    ok: boolean;
    scores: Record<string, number>;
    rationale: string;
  }> = [];

  for (const judgeId of COUNCIL) {
    try {
      const raw = await callJudge(judgeId, prompt);
      const parsed = parseJudgeJson(raw) as {
        scores?: Record<string, number>;
        rationale?: string;
      } | null;
      if (!parsed || !parsed.scores) {
        council.push({ judge_id: judgeId, ok: false, scores: {}, rationale: "" });
        continue;
      }
      const scores: Record<string, number> = {};
      for (const c of ACTIVE_CLASSIFIERS.classifiers) {
        const v = Number(parsed.scores[c.id]);
        if (Number.isFinite(v)) scores[c.id] = Math.max(0, Math.min(5, v));
      }
      council.push({
        judge_id: judgeId,
        ok: Object.keys(scores).length > 0,
        scores,
        rationale: parsed.rationale || "",
      });
    } catch (e) {
      process.stderr.write(
        `  judge ${judgeId} failed on ${poem.perf_slug}/${poem.theme_slug}/${poem.author_type}: ${(e as Error).message.slice(0, 150)}\n`,
      );
      council.push({ judge_id: judgeId, ok: false, scores: {}, rationale: "" });
    }
  }

  const okJudges = council.filter((j) => j.ok);
  if (okJudges.length === 0) return null;

  // Per-classifier council mean
  const aggregated: Record<string, number> = {};
  let stddevSum = 0;
  let stddevCount = 0;
  for (const c of ACTIVE_CLASSIFIERS.classifiers) {
    const vals: number[] = [];
    for (const j of okJudges) {
      if (typeof j.scores[c.id] === "number") vals.push(j.scores[c.id]);
    }
    if (vals.length === 0) continue;
    const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
    aggregated[c.id] = mean;
    if (vals.length >= 2) {
      const variance =
        vals.reduce((s, x) => s + (x - mean) * (x - mean), 0) / vals.length;
      stddevSum += Math.sqrt(variance);
      stddevCount += 1;
    }
  }
  const stddev = stddevCount > 0 ? stddevSum / stddevCount : 0;
  return { scores: aggregated, council, stddev };
}

async function main() {
  const supabase = getSupabase();

  // Pull all archived poems from trained performances + already-scored ids
  const { data: poems } = await supabase
    .from("poems")
    .select(
      "id, theme, theme_slug, author_type, text, performances!inner(slug,status,date)",
    );

  type Raw = {
    id: string;
    theme: string;
    theme_slug: string;
    author_type: string;
    text: string;
    performances:
      | { slug: string; status: string; date: string }
      | { slug: string; status: string; date: string }[];
  };

  const list = (poems ?? []) as unknown as Raw[];
  const archive: ArchivePoem[] = [];
  for (const r of list) {
    const perf = Array.isArray(r.performances) ? r.performances[0] : r.performances;
    if (!perf || perf.status !== "trained") continue;
    if (r.author_type !== "human" && r.author_type !== "machine") continue;
    archive.push({
      id: r.id,
      perf_slug: perf.slug,
      theme: r.theme,
      theme_slug: r.theme_slug,
      author_type: r.author_type,
      text: r.text,
    });
  }

  process.stdout.write(`archive: ${archive.length} poems across trained perfs\n`);

  const { data: existing } = await supabase
    .from("poem_classifier_scores")
    .select("poem_id, classifiers_version")
    .eq("classifiers_version", ACTIVE_CLASSIFIERS_VERSION);
  const scored = new Set(
    ((existing ?? []) as { poem_id: string }[]).map((r) => r.poem_id),
  );

  const todo = archive.filter((p) => !scored.has(p.id));
  process.stdout.write(`already scored: ${scored.size}, remaining: ${todo.length}\n`);

  let n = 0;
  for (const p of todo) {
    n += 1;
    process.stdout.write(
      `[${n}/${todo.length}] ${p.perf_slug}/${p.theme_slug}/${p.author_type}…`,
    );
    const r = await scorePoem(p);
    if (!r) {
      process.stdout.write(` FAILED (all judges down)\n`);
      continue;
    }
    const total = computeClassifierScore(r.scores);
    const { error: insErr } = await supabase
      .from("poem_classifier_scores")
      .upsert(
        {
          poem_id: p.id,
          classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
          scores: r.scores,
          total_score: total,
          council_payload: { judges: r.council },
          inter_rater_avg_stddev: r.stddev,
        },
        { onConflict: "poem_id,classifiers_version" },
      );
    if (insErr) {
      process.stdout.write(` insert error: ${insErr.message}\n`);
      continue;
    }
    process.stdout.write(
      ` score=${(total * 100).toFixed(0)}% σ=${r.stddev.toFixed(2)}\n`,
    );
  }

  process.stdout.write(
    `done. scored ${todo.length} new poem(s). total at v${ACTIVE_CLASSIFIERS_VERSION}: ${
      scored.size + todo.length
    }\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`score-archive-poems crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
