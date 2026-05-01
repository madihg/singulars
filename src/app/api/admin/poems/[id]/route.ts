/**
 * PATCH /api/admin/poems/[id] (US-113, US-104)
 *
 * Body: { vote_count: number, reason?: string }
 *
 * Direct override of poems.vote_count. v1 just writes; v2 will promote the
 * audit log to a poem_vote_overrides table. Logged via console.log JSON.
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

  const { error: updErr } = await supabase
    .from("poems")
    .update({ vote_count: intCount })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  audit({
    audit: "poem.vote_count",
    by: userHashFromRequest(req),
    poem_id: params.id,
    theme_slug: poem.theme_slug,
    author_type: poem.author_type,
    old,
    new: intCount,
    reason,
  });

  return NextResponse.json({
    ok: true,
    changed: true,
    vote_count: intCount,
    delta: intCount - old,
  });
}
