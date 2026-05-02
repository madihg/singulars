/**
 * POST /api/admin/candidate-models/[id]/toggle-public (US-114)
 *
 * Body: { is_public?: boolean } - if omitted, toggles the current value.
 * Side effect: revalidates /api/evals/results (US-115) so the public chart
 * removes/adds the model immediately.
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: cur, error: getErr } = await supabase
    .from("candidate_models")
    .select("id, is_public, name")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr)
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!cur) return NextResponse.json({ error: "not found" }, { status: 404 });

  const next =
    typeof body?.is_public === "boolean" ? body.is_public : !cur.is_public;

  const { data, error } = await supabase
    .from("candidate_models")
    .update({ is_public: next })
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    revalidateTag("eval-results");
  } catch {
    // tag may not be registered yet
  }

  audit({
    audit: "candidate_model.toggle_public",
    by: userHashFromRequest(req),
    id: params.id,
    name: cur.name,
    old: cur.is_public,
    new: next,
  });

  return NextResponse.json({ model: data });
}
