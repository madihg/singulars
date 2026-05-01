/**
 * POST /api/admin/eval-runs/[id]/cancel (US-112)
 *
 * Sets status='cancelled' on the run. The runner script polls for this between
 * themes and aborts; partial scores remain.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export async function POST(
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
    .from("eval_runs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  audit({
    audit: "eval_run.cancel",
    by: userHashFromRequest(req),
    id: params.id,
  });
  return NextResponse.json({ run: data });
}
