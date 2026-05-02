/**
 * POST /api/admin/eval-runs/[id]/rerun (US-112)
 *
 * Clones config_snapshot into a new eval_runs row with status='pending', then
 * fires the runner.
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

  const { data: src, error: gErr } = await supabase
    .from("eval_runs")
    .select("candidate_model_id, performance_id, judge_model, config_snapshot")
    .eq("id", params.id)
    .maybeSingle();
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });

  const userHash = userHashFromRequest(req) || "unknown";
  const { data: inserted, error: iErr } = await supabase
    .from("eval_runs")
    .insert({
      candidate_model_id: src.candidate_model_id,
      performance_id: src.performance_id,
      judge_model: src.judge_model,
      config_snapshot: src.config_snapshot,
      triggered_by: "manual",
      triggered_by_user: userHash,
    })
    .select("id")
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  audit({
    audit: "eval_run.rerun",
    by: userHash,
    source_id: params.id,
    new_id: inserted.id,
  });

  const origin = new URL(req.url).origin;
  fetch(`${origin}/api/admin/eval-runs/${inserted.id}/_run`, {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => {});

  return NextResponse.json({ id: inserted.id });
}
