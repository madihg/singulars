/**
 * GET /api/admin/poems/[id]/overrides (US §9.4)
 *
 * Returns the override history for a poem, newest first. Auth-gated. Surfaces
 * created_at, online_count_at_override, manual_delta, new_total, reason, by,
 * supercedes, active.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
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

  const { data, error } = await supabase
    .from("poem_vote_overrides")
    .select(
      "id, online_count_at_override, manual_delta, new_total, reason, by, supercedes, active, created_at",
    )
    .eq("poem_id", params.id)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ overrides: data || [] });
}
