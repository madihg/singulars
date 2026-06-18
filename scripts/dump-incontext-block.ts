/**
 * scripts/dump-incontext-block.ts
 *
 * Regenerates the curated in-context exemplar block for the production
 * frontière model (src/lib/models.ts FRONTIERE_IN_CONTEXT_BLOCK). Mirrors
 * getCuratedInContextBlock() in run-eval.ts, but:
 *   - includes ALL completed shows (nothing held out at show time), excluding
 *     only upcoming perfs (recover-exe, ground-exe) which have no audience data;
 *   - takes the top-N highest-vote-margin (winner, loser) pairs, and then
 *     GUARANTEES the most recent show (frontiere-exe) is represented by
 *     appending its strongest pair if it didn't make the top-N.
 *
 * Run: set -a && source .env.local.bak && set +a && npx tsx scripts/dump-incontext-block.ts
 * Then paste the printed block over FRONTIERE_IN_CONTEXT_BLOCK in models.ts.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TOP_N = 5;
const RECENCY_PERF = "frontiere-exe"; // always represent the newest show
const EXCLUDE_PERFS = new Set(["recover-exe", "ground-exe"]); // upcoming, no data

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    process.stderr.write(
      "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    db: { schema: "singulars" },
  }) as unknown as SupabaseClient;

  const { data: poems, error } = await supabase
    .from("poems")
    .select(
      "theme, theme_slug, author_type, vote_count, text, performances!inner(slug,status)",
    );
  if (error) {
    process.stderr.write(`query failed: ${error.message}\n`);
    process.exit(1);
  }

  type PoemRow = {
    theme: string;
    theme_slug: string;
    author_type: string;
    vote_count: number;
    text: string;
    performances: { slug: string; status: string } | { slug: string; status: string }[];
  };
  type Group = {
    perf: string;
    theme: string;
    h_text: string;
    h_votes: number;
    m_text: string;
    m_votes: number;
  };

  const grouped: Record<string, Group> = {};
  for (const r of (poems ?? []) as unknown as PoemRow[]) {
    const perf = Array.isArray(r.performances)
      ? r.performances[0]?.slug
      : r.performances?.slug;
    if (!perf || EXCLUDE_PERFS.has(perf)) continue;
    const k = `${perf}|${r.theme_slug}`;
    if (!grouped[k]) {
      grouped[k] = { perf, theme: r.theme, h_text: "", h_votes: -1, m_text: "", m_votes: -1 };
    }
    if (r.author_type === "human") {
      grouped[k].h_text = r.text;
      grouped[k].h_votes = r.vote_count;
    } else if (r.author_type === "machine") {
      grouped[k].m_text = r.text;
      grouped[k].m_votes = r.vote_count;
    }
  }

  const allPairs = Object.values(grouped)
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
    .sort((a, b) => b.margin - a.margin);

  const chosen = allPairs.slice(0, TOP_N);
  // Recency guarantee: ensure the newest show is represented.
  if (!chosen.some((p) => p.perf === RECENCY_PERF)) {
    const newest = allPairs.find((p) => p.perf === RECENCY_PERF);
    if (newest) chosen.push(newest);
  }

  const block = chosen
    .map(
      (p, i) =>
        `EXAMPLE ${i + 1} (theme: ${p.theme}, perf: ${p.perf}, audience-margin: ${p.margin})

The audience CHOSE this poem:
${p.winner_text.trim()}

The audience REJECTED this poem:
${p.loser_text.trim()}`,
    )
    .join("\n\n---\n\n");

  process.stdout.write("\n===== BEGIN IN-CONTEXT BLOCK =====\n\n");
  process.stdout.write(block);
  process.stdout.write("\n\n===== END IN-CONTEXT BLOCK =====\n");
  process.stdout.write(
    `\n(${chosen.length} pairs; perfs: ${chosen.map((p) => p.perf).join(", ")})\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`crashed: ${e?.stack || e?.message || e}\n`);
  process.exit(1);
});
