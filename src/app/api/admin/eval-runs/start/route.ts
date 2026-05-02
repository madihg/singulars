/**
 * POST /api/admin/eval-runs/start (US-111)
 *
 * Body: {
 *   performance_id: uuid,
 *   candidate_model_ids: uuid[],
 *   judge_model: string,            // e.g. "openai:gpt-5-5"
 *   cost_cap_usd?: number,
 *   n_per_theme?: number
 * }
 *
 * Creates one eval_runs row per candidate model with status='pending', then
 * fires (and forgets) the per-row runner via /api/admin/eval-runs/[id]/_run.
 *
 * Returns { run_ids: uuid[] } immediately.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

const KNOWN_JUDGE_PROVIDERS = [
  "openai:",
  "anthropic:",
  "google:",
  "openrouter:",
  "together:",
];

function looksLikeProviderModel(s: unknown): s is string {
  return (
    typeof s === "string" &&
    KNOWN_JUDGE_PROVIDERS.some((p) => s.startsWith(p)) &&
    s.length > 5
  );
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const performanceId = body?.performance_id;
  const candidateIds = body?.candidate_model_ids;
  const judgeModel = body?.judge_model;
  const costCap = body?.cost_cap_usd;
  const nPerTheme = body?.n_per_theme;

  if (typeof performanceId !== "string") {
    return NextResponse.json(
      { error: "performance_id required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return NextResponse.json(
      { error: "candidate_model_ids must be a non-empty array" },
      { status: 400 },
    );
  }
  if (!looksLikeProviderModel(judgeModel)) {
    return NextResponse.json(
      { error: "judge_model must look like 'provider:model'" },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  // Validate performance is trained
  const { data: perf, error: pErr } = await supabase
    .from("performances")
    .select("id, slug, status, name")
    .eq("id", performanceId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!perf) {
    return NextResponse.json(
      { error: "performance not found" },
      { status: 404 },
    );
  }
  if (perf.status !== "trained") {
    return NextResponse.json(
      { error: "performance not trained" },
      { status: 400 },
    );
  }

  // Validate candidates are non-archived
  const { data: candidates, error: cErr } = await supabase
    .from("candidate_models")
    .select("id, name, slug, archived")
    .in("id", candidateIds);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!candidates || candidates.length !== candidateIds.length) {
    return NextResponse.json(
      { error: "one or more candidate_model_ids not found" },
      { status: 400 },
    );
  }
  const archivedHit = candidates.find((c) => c.archived);
  if (archivedHit) {
    return NextResponse.json(
      { error: `candidate ${archivedHit.name} is archived` },
      { status: 400 },
    );
  }

  // Insert one row per candidate
  const userHash = userHashFromRequest(req) || "unknown";
  const insertRows = candidateIds.map((cid: string) => ({
    candidate_model_id: cid,
    performance_id: performanceId,
    judge_model: judgeModel,
    triggered_by: "manual" as const,
    triggered_by_user: userHash,
    config_snapshot: {
      judge_model: judgeModel,
      cost_cap_usd: typeof costCap === "number" ? costCap : null,
      n_per_theme: typeof nPerTheme === "number" ? nPerTheme : 3,
    },
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("eval_runs")
    .insert(insertRows)
    .select("id");
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  const runIds = (inserted ?? []).map((r) => r.id as string);

  audit({
    audit: "eval_run.start",
    by: userHash,
    performance_id: performanceId,
    candidate_count: candidateIds.length,
    judge_model: judgeModel,
    run_ids: runIds,
  });

  // Fire-and-forget the runner per row.
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") || "";
  for (const id of runIds) {
    fetch(`${origin}/api/admin/eval-runs/${id}/_run`, {
      method: "POST",
      headers: { cookie },
    }).catch(() => {
      /* swallow - the row stays pending; user can rerun */
    });
  }

  return NextResponse.json({ run_ids: runIds });
}
