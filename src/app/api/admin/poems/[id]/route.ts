/**
 * PATCH /api/admin/poems/[id] (US-113, US-104, §9.4 resolution)
 *
 * Body: { vote_count: number, reason?: string }
 *
 * Calls singulars.apply_vote_override(p_poem_id, p_new_total, p_reason, p_by) which:
 *   1. snapshots COUNT(votes) for the poem
 *   2. supercedes prior active overrides
 *   3. inserts a new active override row with manual_delta = new_total - online_count
 *   4. updates poems.vote_count to the new_total
 *
 * cast_vote (the live online-vote RPC) is unchanged. The two coexist because
 * each online vote increments both COUNT(votes) AND poems.vote_count by 1
 * while the latest manual_delta is unaffected.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const newCount = body?.vote_count;
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (
    typeof newCount !== "number" ||
    newCount < 0 ||
    !Number.isFinite(newCount)
  ) {
    return NextResponse.json(
      { error: "vote_count must be a non-negative integer" },
      { status: 400 },
    );
  }
  const intCount = Math.floor(newCount);

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: poem, error: getErr } = await supabase
    .from("poems")
    .select("id, vote_count, theme_slug, author_type, performance_id")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr)
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!poem) {
    return NextResponse.json({ error: "poem not found" }, { status: 404 });
  }

  const old = (poem.vote_count as number) || 0;
  if (old === intCount) {
    return NextResponse.json({
      ok: true,
      changed: false,
      vote_count: intCount,
    });
  }

  const userHash = userHashFromRequest(req);
  const { data: override, error: rpcErr } = await supabase.rpc(
    "apply_vote_override",
    {
      p_poem_id: params.id,
      p_new_total: intCount,
      p_reason: reason,
      p_by: userHash,
    },
  );
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // The console audit trail stays in addition to the DB row so Vercel Logs
  // retain a record even if a future migration drops the table.
  audit({
    audit: "poem.vote_count",
    by: userHash,
    poem_id: params.id,
    theme_slug: poem.theme_slug,
    author_type: poem.author_type,
    old,
    new: intCount,
    reason,
    override_id: override?.id ?? null,
    manual_delta: override?.manual_delta ?? null,
    online_count_at_override: override?.online_count_at_override ?? null,
  });

  return NextResponse.json({
    ok: true,
    changed: true,
    vote_count: intCount,
    delta: intCount - old,
    override_id: override?.id ?? null,
  });
}
