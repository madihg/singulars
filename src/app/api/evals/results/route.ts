/**
 * GET /api/evals/results (US-115)
 *
 * Public, RLS-gated. Reads from singulars.v_model_winrate_per_performance
 * (RLS auto-filters to published=true AND status='completed' AND model is_public).
 *
 * Returns: { performances, models[].series } shape per research/05 §3.1.
 *
 * Cache: s-maxage=300, swr=86400, tagged "eval-results" for revalidateTag().
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

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
    series: Array<{ perf: string; rate: number; n_themes: number }>;
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
    .select("model_slug, performance_slug, win_rate, n_themes");

  const seriesByModel: Record<
    string,
    Array<{ perf: string; rate: number; n_themes: number }>
  > = {};
  for (const r of rows ?? []) {
    const slug = r.model_slug as string;
    if (!seriesByModel[slug]) seriesByModel[slug] = [];
    seriesByModel[slug].push({
      perf: r.performance_slug as string,
      rate: Number(r.win_rate) || 0,
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

const cachedLoad = unstable_cache(loadResults, ["eval-results"], {
  tags: ["eval-results"],
  revalidate: 300,
});

export async function GET() {
  const data = await cachedLoad();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
