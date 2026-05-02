/**
 * GET /api/admin/fine-tunes (US-124 list)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

  const { data, error } = await supabase
    .from("fine_tune_jobs")
    .select(
      "*, candidate:candidate_models!fine_tune_jobs_auto_registered_candidate_id_fkey(id, name, color, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}
