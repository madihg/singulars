/**
 * POST /api/admin/performances/[slug]/sync-tallies (US-113, US-103, §9.4 resolution)
 *
 * Reconciles poems.vote_count = COUNT(votes_for_poem) + latest_active_override.manual_delta
 * for every poem in this performance. This RECONCILES rather than wipes - manual paper-ballot
 * overrides are preserved.
 *
 * Returns: { ok, updated: <n poems whose vote_count changed>, total: <n poems checked> }
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

  // Live online vote counts.
  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("poem_id")
    .in("poem_id", poemIds);
  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }
  const onlineByPoem: Record<string, number> = {};
  for (const v of votes ?? []) {
    const pid = v.poem_id as string;
    onlineByPoem[pid] = (onlineByPoem[pid] || 0) + 1;
  }

  // Latest active override delta per poem.
  const { data: overrides, error: oErr } = await supabase
    .from("poem_vote_overrides")
    .select("poem_id, manual_delta, created_at")
    .eq("active", true)
    .in("poem_id", poemIds)
    .order("created_at", { ascending: false });
  if (oErr) {
    return NextResponse.json({ error: oErr.message }, { status: 500 });
  }
  const overrideDeltaByPoem: Record<string, number> = {};
  for (const o of overrides ?? []) {
    const pid = o.poem_id as string;
    if (overrideDeltaByPoem[pid] === undefined) {
      // first occurrence is newest by ORDER BY clause
      overrideDeltaByPoem[pid] = (o.manual_delta as number) || 0;
    }
  }

  // Reconcile: vote_count = online + manual_delta. Update only rows that diverge.
  let updated = 0;
  const diffs: Array<{
    poem_id: string;
    old: number;
    new: number;
    online: number;
    delta: number;
  }> = [];
  for (const p of poems) {
    const pid = p.id as string;
    const old = (p.vote_count as number) || 0;
    const online = onlineByPoem[pid] || 0;
    const delta = overrideDeltaByPoem[pid] || 0;
    const next = online + delta;
    if (old !== next) {
      const { error: uErr } = await supabase
        .from("poems")
        .update({ vote_count: next })
        .eq("id", pid);
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 500 });
      }
      updated += 1;
      diffs.push({ poem_id: pid, old, new: next, online, delta });
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
