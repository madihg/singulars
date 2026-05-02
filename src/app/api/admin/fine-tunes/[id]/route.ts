/**
 * GET /api/admin/fine-tunes/[id] (US-124 detail)
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
    .from("fine_tune_jobs")
    .select(
      "*, candidate:candidate_models!fine_tune_jobs_auto_registered_candidate_id_fkey(id, name, color, slug)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job: data });
}
