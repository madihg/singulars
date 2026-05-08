/**
 * scripts/extract-classifiers.ts
 *
 * One-shot analyzer: pulls every (audience-winner, audience-loser) pair from
 * trained performances and asks Claude Opus 4.7 to extract 5-7 classifiers
 * that capture what consistently distinguishes audience-chosen poems from
 * audience-rejected ones.
 *
 * The output is written to stdout as JSON. Halim reviews; we then paste the
 * approved set into src/lib/audience-classifiers.ts as the active artifact.
 *
 * The classifiers are the audience's taste, codified - not the LLM's poetic
 * preferences. They become the rubric the eval judge uses to score
 * candidates (replacing "rank A vs B vs C" subjective judging).
 *
 * Run: `set -a && source .env.local && set +a && npx tsx scripts/extract-classifiers.ts`
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    process.stderr.write("missing supabase env vars\n");
    process.exit(1);
  }
  return createClient(url, key, { db: { schema: "singulars" } });
}

type Pair = {
  perf: string;
  theme: string;
  vote_margin: number;
  winner_text: string;
  loser_text: string;
  winner_type: string;
  loser_type: string;
};

const EXTRACTION_PROMPT = `You are a literary analyst extracting an "audience taste profile" from real performance data.

You will see N (winner, loser) poem pairs from a series of live human-vs-machine poetry performances. Each pair was decided by an audience vote at the show. The winner is the poem the room voted for; the loser is the poem the room rejected. Some winners are by the human poet (Halim Madi); some are by an AI. Same with losers. Your task is NOT to identify which were human vs AI. Your task is to identify what consistently makes the audience-chosen poems distinct from the audience-rejected ones.

Read all pairs. Look for patterns where the winner exhibits a quality the loser lacks (or vice versa). Discard your priors about what "good poetry" is - the audience already decided. Reverse-engineer their taste.

Output 5-7 classifiers. Each classifier is a binary-ish dimension where winners cluster on one end and losers on the other. For each:
  - id (e.g. "C1", "C2")
  - name (3-5 words)
  - definition (1 sentence describing what's being measured, in plain language a non-LLM judge could apply)
  - winner_pole (1 sentence describing what winners look like on this axis)
  - loser_pole (1 sentence describing what losers look like)
  - winner_exemplars: 2 short excerpts from actual winner poems below, with perf and theme
  - loser_exemplars: 2 short excerpts from actual loser poems below, with perf and theme
  - weight: 1-3 (how strongly this dimension separates winners from losers in the data)

Avoid overlapping classifiers. Each should capture a distinct pattern.

Output STRICT JSON, no other text:
{
  "version": "v1-2026-05-08",
  "extracted_at": "2026-05-08",
  "n_pairs_analyzed": <int>,
  "summary": "<one paragraph describing the audience's overall taste profile>",
  "classifiers": [ ... ]
}

Pairs follow.

`;

async function main() {
  const supabase = getSupabase();

  // Pull all winner/loser pairs across trained performances.
  const { data: rows, error } = await supabase.rpc(
    "get_all_audience_pairs_for_extraction",
  );

  let pairs: Pair[] = [];
  if (error || !rows) {
    // RPC doesn't exist yet - fall back to inline aggregation
    process.stderr.write(
      `RPC not present, falling back to inline query: ${error?.message || "no rows"}\n`,
    );
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
      performances: { slug: string; status: string }[] | { slug: string; status: string };
    };
    const list = (poems ?? []) as unknown as PoemRow[];
    type Group = {
      perf: string;
      status: string;
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
      const status = Array.isArray(r.performances)
        ? r.performances[0]?.status
        : r.performances?.status;
      if (!perf) continue;
      const k = `${perf}|${r.theme_slug}`;
      if (!grouped[k]) {
        grouped[k] = {
          perf,
          status,
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
    pairs = Object.values(grouped)
      .filter(
        (g) =>
          g.status === "trained" &&
          g.h_text &&
          g.m_text &&
          g.h_votes !== g.m_votes,
      )
      .map((g) => {
        const humanWon = g.h_votes > g.m_votes;
        return {
          perf: g.perf,
          theme: g.theme,
          vote_margin: Math.abs(g.h_votes - g.m_votes),
          winner_text: humanWon ? g.h_text : g.m_text,
          loser_text: humanWon ? g.m_text : g.h_text,
          winner_type: humanWon ? "human" : "machine",
          loser_type: humanWon ? "machine" : "human",
        };
      });
  } else {
    pairs = rows as Pair[];
  }

  // Sort by vote margin descending - clearest signal first
  pairs.sort((a, b) => b.vote_margin - a.vote_margin);

  process.stderr.write(`pulled ${pairs.length} pairs\n`);

  // Build the prompt
  const pairsBlock = pairs
    .map(
      (p, i) => `--- PAIR ${i + 1} (perf=${p.perf}, theme=${p.theme}, vote_margin=${p.vote_margin}, winner=${p.winner_type}, loser=${p.loser_type}) ---

WINNER:
${p.winner_text.trim()}

LOSER:
${p.loser_text.trim()}
`,
    )
    .join("\n");

  const prompt = EXTRACTION_PROMPT + pairsBlock;

  process.stderr.write(`prompt size: ~${Math.round(prompt.length / 4)} tokens\n`);
  process.stderr.write(`calling claude-opus-4-7…\n`);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    process.stderr.write("missing ANTHROPIC_API_KEY\n");
    process.exit(1);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    process.stderr.write(`claude http ${res.status}: ${await res.text()}\n`);
    process.exit(1);
  }
  const j = await res.json();
  const raw: string = j.content?.[0]?.text || "";

  // Strip code fences if any, then output to stdout for piping into the
  // versioned artifact file.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  process.stdout.write(cleaned + "\n");
}

main().catch((e) => {
  process.stderr.write(`extract-classifiers crashed: ${e?.stack || e}\n`);
  process.exit(1);
});
