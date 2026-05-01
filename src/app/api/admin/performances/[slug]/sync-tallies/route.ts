/**
 * POST /api/admin/performances/[slug]/sync-tallies (US-113, US-103)
 *
 * Recomputes singulars.poems.vote_count from the singulars.votes table for
 * every poem in this performance. Returns the diff:
 *   { ok: true, updated: <n poems whose vote_count changed>, total: <n poems checked> }
 *
 * vote_count is a denormalised cache; sync reconciles it after manual
 * vote-row edits or import jobs.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  // Find the performance.
  const { data: perf, error: pErr } = await supabase
    .from("performances")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!perf) {
    return NextResponse.json(
      { error: "performance not found" },
      { status: 404 },
    );
  }

  // Pull all poems for this performance with their cached vote_count.
  const { data: poems, error: poemErr } = await supabase
    .from("poems")
    .select("id, vote_count")
    .eq("performance_id", perf.id);
  if (poemErr) {
    return NextResponse.json({ error: poemErr.message }, { status: 500 });
  }

  if (!poems || poems.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, total: 0 });
  }

  const poemIds = poems.map((p) => p.id as string);

  // Pull the actual vote counts grouped by poem_id.
  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("poem_id")
    .in("poem_id", poemIds);
  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }
  const actualByPoem: Record<string, number> = {};
  for (const v of votes ?? []) {
    const pid = v.poem_id as string;
    actualByPoem[pid] = (actualByPoem[pid] || 0) + 1;
  }

  // Find rows whose cache diverges and update only those.
  let updated = 0;
  const diffs: Array<{ poem_id: string; old: number; new: number }> = [];
  for (const p of poems) {
    const old = (p.vote_count as number) || 0;
    const next = actualByPoem[p.id as string] || 0;
    if (old !== next) {
      const { error: uErr } = await supabase
        .from("poems")
        .update({ vote_count: next })
        .eq("id", p.id);
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      updated += 1;
      diffs.push({ poem_id: p.id as string, old, new: next });
    }
  }

  audit({
    audit: "performance.sync_tallies",
    by: userHashFromRequest(req),
    slug: params.slug,
    name: perf.name,
    total: poems.length,
    updated,
    diffs,
  });

  return NextResponse.json({
    ok: true,
    updated,
    total: poems.length,
  });
}
