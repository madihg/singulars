/**
 * GET /api/admin/performances (US-113)
 *
 * Returns every performance with a vote-pair count and total vote tally,
 * powering the /admin/performances list (US-103).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PerfRow = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  status: "upcoming" | "training" | "trained";
  color: string;
  location: string | null;
  vote_pair_count: number;
  total_votes: number;
};

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: perfs, error: pErr } = await supabase
    .from("performances")
    .select("id, slug, name, date, status, color, location")
    .order("date", { ascending: false, nullsFirst: false });
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // For vote-pair counts we need to know themes per performance that have BOTH a
  // human and machine poem. Cheapest path: fetch all poems grouped by perf+theme
  // and count themes with both author_types present.
  const { data: poems, error: poemErr } = await supabase
    .from("poems")
    .select("performance_id, theme_slug, author_type, vote_count");
  if (poemErr) {
    return NextResponse.json({ error: poemErr.message }, { status: 500 });
  }

  const byPerf: Record<string, Map<string, Set<string>>> = {};
  const totalVotesByPerf: Record<string, number> = {};
  for (const p of poems ?? []) {
    const perfId = p.performance_id as string;
    const themeKey = p.theme_slug as string;
    const author = p.author_type as string;
    if (!byPerf[perfId]) byPerf[perfId] = new Map();
    if (!byPerf[perfId].has(themeKey)) byPerf[perfId].set(themeKey, new Set());
    byPerf[perfId].get(themeKey)!.add(author);
    totalVotesByPerf[perfId] =
      (totalVotesByPerf[perfId] || 0) + (p.vote_count || 0);
  }

  const rows: PerfRow[] = (perfs ?? []).map((p) => {
    const themes = byPerf[p.id as string];
    const pairCount = themes
      ? Array.from(themes.values()).filter(
          (s) => s.has("human") && s.has("machine"),
        ).length
      : 0;
    return {
      id: p.id as string,
      slug: p.slug as string,
      name: p.name as string,
      date: (p.date as string | null) ?? null,
      status: p.status as PerfRow["status"],
      color: (p.color as string) ?? "#888",
      location: (p.location as string | null) ?? null,
      vote_pair_count: pairCount,
      total_votes: totalVotesByPerf[p.id as string] || 0,
    };
  });

  return NextResponse.json({ performances: rows });
}
