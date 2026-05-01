/**
 * GET /api/admin/eval-runs (US-106)
 *
 * Query params:
 *   ?perf=<slug>     filter by performance
 *   ?status=...       comma-separated status filter
 *   ?model=<slug>    filter by candidate model
 *   ?limit=N          page size (default 50)
 *   ?offset=N         offset for pagination
 *
 * Returns rows joined with candidate model + performance metadata.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const perf = url.searchParams.get("perf");
  const status = url.searchParams.get("status");
  const modelSlug = url.searchParams.get("model");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || "50"), 1),
    200,
  );
  const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  let query = supabase
    .from("eval_runs")
    .select(
      "id, status, judge_model, n_themes, n_themes_completed, win_rate, mean_rank, cost_usd, started_at, finished_at, duration_ms, published, error_message, created_at, candidate_model:candidate_models(id, slug, name, color, family), performance:performances(id, slug, name, color, date, status)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    query = query.in("status", statuses);
  }

  // perf and modelSlug filters need joins; do client-side filter in two passes.
  const { data, error, count } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: string;
    candidate_model: { slug: string } | null;
    performance: { slug: string } | null;
  };
  let filtered = (data ?? []) as unknown as Row[];
  if (perf) {
    filtered = filtered.filter((r) => r.performance?.slug === perf);
  }
  if (modelSlug) {
    filtered = filtered.filter((r) => r.candidate_model?.slug === modelSlug);
  }

  return NextResponse.json({
    runs: filtered,
    total: count ?? filtered.length,
    limit,
    offset,
  });
}
