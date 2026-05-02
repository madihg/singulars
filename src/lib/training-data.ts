/**
 * Training data export builder (US-121, US-123).
 *
 * Turns audience-voted (theme, winner, loser) tuples into JSONL ready to ship
 * to OpenAI / Together / etc. Used by:
 *   - /api/admin/training-data/export (US-121 download)
 *   - /api/admin/fine-tunes/start (US-123 generates JSONL inline before upload)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TrainingFormat = "sft" | "dpo";

export type TupleRow = {
  theme: string;
  theme_slug: string;
  winner_text: string;
  winner_type: string;
  loser_text: string;
  loser_type: string;
};

export const DEFAULT_SYSTEM_PROMPT =
  "You are a poet. Write a short poem on the given theme. No preamble. Free verse. 8-24 lines. Avoid 'tapestry', 'whispers', em-dash overuse.";

export type ExportOptions = {
  format: TrainingFormat;
  systemPrompt: string;
  performanceSlugs: string[];
  excludeThemeSlugs?: string[];
  holdoutPerformanceSlug?: string | null;
};

export type ExportResult = {
  jsonl: string;
  rows: number;
  approxTokens: number;
  preview: string[]; // first 5 rows pretty-printed (not minified)
  holdoutJsonl?: string;
  holdoutRows?: number;
};

/** Approximate tokens per row (4 chars per token rule of thumb). */
function estimateTokens(rows: object[]): number {
  let chars = 0;
  for (const r of rows) chars += JSON.stringify(r).length;
  return Math.round(chars / 4);
}

function rowSft(t: TupleRow, system: string): object {
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: t.theme },
      { role: "assistant", content: t.winner_text },
    ],
  };
}

function rowDpo(t: TupleRow, system: string): object {
  return {
    input: {
      messages: [
        { role: "system", content: system },
        { role: "user", content: t.theme },
      ],
    },
    preferred_output: [{ role: "assistant", content: t.winner_text }],
    non_preferred_output: [{ role: "assistant", content: t.loser_text }],
  };
}

export async function buildExport(
  supabase: SupabaseClient,
  opts: ExportOptions,
): Promise<ExportResult> {
  const exclude = new Set(opts.excludeThemeSlugs || []);

  // Pull tuples for each requested performance via the RPC.
  const all: Array<TupleRow & { perfSlug: string }> = [];
  for (const slug of opts.performanceSlugs) {
    const { data } = await supabase.rpc("golden_tuples_for_performance", {
      p_slug: slug,
    });
    for (const t of (data ?? []) as TupleRow[]) {
      if (exclude.has(t.theme_slug)) continue;
      all.push({ ...t, perfSlug: slug });
    }
  }

  const holdoutSlug = opts.holdoutPerformanceSlug || null;
  const trainTuples = all.filter((t) => t.perfSlug !== holdoutSlug);
  const holdoutTuples = holdoutSlug
    ? all.filter((t) => t.perfSlug === holdoutSlug)
    : [];

  const buildRow = opts.format === "sft" ? rowSft : rowDpo;
  const trainRows = trainTuples.map((t) => buildRow(t, opts.systemPrompt));
  const holdoutRows = holdoutTuples.map((t) => buildRow(t, opts.systemPrompt));

  const jsonl = trainRows.map((r) => JSON.stringify(r)).join("\n");
  const holdoutJsonl =
    holdoutRows.length > 0
      ? holdoutRows.map((r) => JSON.stringify(r)).join("\n")
      : undefined;

  return {
    jsonl,
    rows: trainRows.length,
    approxTokens: estimateTokens(trainRows),
    preview: trainRows.slice(0, 5).map((r) => JSON.stringify(r, null, 2)),
    holdoutJsonl,
    holdoutRows: holdoutRows.length || undefined,
  };
}

export function autoFilename(opts: {
  format: TrainingFormat;
  nPerfs: number;
  holdoutSlug: string | null;
}): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const base = `singulars-${opts.format}-${opts.nPerfs}perfs-${date}`;
  return opts.holdoutSlug
    ? `${base}-holdout-${opts.holdoutSlug}.jsonl`
    : `${base}.jsonl`;
}
