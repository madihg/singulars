/**
 * GET /api/evals/results (US-115)
 *
 * Public, RLS-gated. Reads from singulars.v_model_winrate_per_performance
 * (RLS auto-filters to published=true AND status='completed' AND model is_public).
 *
 * Returns: { performances, models[].series } shape per research/05 §3.1.
 *
 * No caching - the loader is three simple Postgres queries (a few ms each).
 * unstable_cache + s-maxage=300 dual-caching previously caused stale empty
 * responses to persist for 5 minutes after toggling models public, because
 * revalidateTag invalidates unstable_cache but not Vercel's edge HTTP cache,
 * and the persisted Data Cache also outlived deploys. Always-fresh is fine
 * here.
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChartData = {
  performances: Array<{
    slug: string;
    name: string;
    color: string;
    location: string | null;
    date: string | null;
    status: string;
  }>;
  models: Array<{
    slug: string;
    name: string;
    family: string;
    color: string;
    is_public: boolean;
    series: Array<{
      perf: string;
      rate: number;
      score: number;
      mean_rank: number | null;
      n_themes: number;
    }>;
  }>;
};

async function loadResults(): Promise<ChartData> {
  // Use anon client so RLS gates - this is public data.
  const supabase = getSupabase() || getServiceClient();
  if (!supabase) {
    return { performances: [], models: [] };
  }

  // 1. Performances (read all - they are public).
  const { data: perfs } = await supabase
    .from("performances")
    .select("slug, name, color, location, date, status")
    .order("date", { ascending: true, nullsFirst: false });

  // 2. Public models.
  const { data: models } = await supabase
    .from("candidate_models")
    .select("slug, name, family, color, is_public")
    .eq("is_public", true)
    .eq("archived", false)
    .order("name");

  // 3. Win-rate view rows (RLS pre-filters to published+completed).
  const { data: rows } = await supabase
    .from("v_model_winrate_per_performance")
    .select("model_slug, performance_slug, win_rate, mean_rank, n_themes");

  // score = (3 - mean_rank) / 2  →  rank 1 = 1.0, rank 2 = 0.5, rank 3 = 0.0
  // Higher = better. Falls back to binary win_rate when mean_rank is null
  // (only happens for very old runs that pre-date the backfill).
  const seriesByModel: Record<
    string,
    Array<{
      perf: string;
      rate: number;
      score: number;
      mean_rank: number | null;
      n_themes: number;
    }>
  > = {};
  for (const r of rows ?? []) {
    const slug = r.model_slug as string;
    if (!seriesByModel[slug]) seriesByModel[slug] = [];
    const meanRank =
      r.mean_rank == null ? null : Number(r.mean_rank);
    const winRate = Number(r.win_rate) || 0;
    const score =
      meanRank != null
        ? Math.max(0, Math.min(1, (3 - meanRank) / 2))
        : winRate;
    seriesByModel[slug].push({
      perf: r.performance_slug as string,
      rate: winRate,
      score,
      mean_rank: meanRank,
      n_themes: (r.n_themes as number) || 0,
    });
  }

  return {
    performances: (perfs ?? []) as ChartData["performances"],
    models: (models ?? []).map((m) => ({
      slug: m.slug as string,
      name: m.name as string,
      family: m.family as string,
      color: m.color as string,
      is_public: !!m.is_public,
      series: seriesByModel[m.slug as string] || [],
    })),
  };
}

export async function GET() {
  const data = await loadResults();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
