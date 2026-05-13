/**
 * GET /api/evals/quality-trajectory
 *
 * Per-performance average classifier score for both authors (Halim, machine),
 * computed retroactively from the actual poem texts archived in
 * singulars.poems. Powers the "machine quality trajectory" line chart on
 * /evolution - the question "did each author improve on audience-taste
 * dimensions across the series, regardless of who won the live vote?"
 *
 * Reads singulars.v_machine_quality_trajectory (anon-readable view).
 * Pending performances (upcoming, e.g. ground.exe) are surfaced separately
 * so the chart can show a placeholder at the end of the x-axis.
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";
import { ACTIVE_CLASSIFIERS_VERSION } from "@/lib/audience-classifiers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TrajectoryPoint = {
  perf_slug: string;
  perf_name: string;
  perf_date: string | null;
  perf_color: string;
  perf_status: string;
  avg_score: number;
  n_poems: number;
  stddev_score: number | null;
};

type Body = {
  classifiers_version: string;
  performances: Array<{
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
    perf_status: string;
    pending: boolean;
    /** Total audience-decided themes at this performance (from v_audience_machine_vs_human). */
    n_themes_total: number;
    /** True when both authors have classifier scores for every theme at this perf. */
    complete: boolean;
  }>;
  series: {
    human: TrajectoryPoint[];
    machine: TrajectoryPoint[];
  };
  /** Progress indicator for in-flight retroactive scoring. */
  scoring_progress: {
    poems_scored: number;
    poems_total: number;
    complete: boolean;
  };
};

async function loadTrajectory(): Promise<Body> {
  const supabase = getSupabase() || getServiceClient();
  const emptyResp: Body = {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    performances: [],
    series: { human: [], machine: [] },
    scoring_progress: { poems_scored: 0, poems_total: 0, complete: true },
  };
  if (!supabase) return emptyResp;

  const { data: viewRows } = await supabase
    .from("v_machine_quality_trajectory")
    .select(
      "perf_slug, perf_name, perf_date, perf_color, perf_status, author_type, avg_score, stddev_score, n_poems",
    );

  const { data: perfs } = await supabase
    .from("performances")
    .select("slug, name, date, color, status")
    .order("date", { ascending: true, nullsFirst: false });

  // Audience theme counts per performance, used to determine whether
  // scoring is complete (both authors scored on every theme).
  const { data: audienceRows } = await supabase
    .from("v_audience_machine_vs_human")
    .select("perf_slug, n_themes");
  const themesByPerf = new Map<string, number>();
  for (const r of (audienceRows ?? []) as {
    perf_slug: string;
    n_themes: number;
  }[]) {
    themesByPerf.set(r.perf_slug, r.n_themes);
  }

  type RawRow = {
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
    perf_status: string;
    author_type: "human" | "machine";
    avg_score: string | number;
    stddev_score: string | number | null;
    n_poems: number;
  };

  const human: TrajectoryPoint[] = [];
  const machine: TrajectoryPoint[] = [];
  for (const r of (viewRows ?? []) as RawRow[]) {
    const point: TrajectoryPoint = {
      perf_slug: r.perf_slug,
      perf_name: r.perf_name,
      perf_date: r.perf_date,
      perf_color: r.perf_color,
      perf_status: r.perf_status,
      avg_score: Number(r.avg_score) || 0,
      n_poems: r.n_poems || 0,
      stddev_score: r.stddev_score == null ? null : Number(r.stddev_score),
    };
    if (r.author_type === "human") human.push(point);
    else if (r.author_type === "machine") machine.push(point);
  }

  // Sort by perf_date for clean line trajectory
  const byDate = (a: TrajectoryPoint, b: TrajectoryPoint) =>
    (a.perf_date || "").localeCompare(b.perf_date || "");
  human.sort(byDate);
  machine.sort(byDate);

  const performances = (perfs ?? [])
    // Hide ground.exe (moved to Currents Santa Fe 2027 - too far out to
    // display as a pending placeholder).
    .filter((p) => p.slug !== "ground-exe")
    .map((p) => {
    const slug = p.slug as string;
    const h = human.find((x) => x.perf_slug === slug);
    const m = machine.find((x) => x.perf_slug === slug);
    const hasData = !!h || !!m;
    const expected = themesByPerf.get(slug) ?? 0;
    // "complete" means both authors have classifier scores on every audience-
    // decided theme. Partial perfs render as in-flight on the chart rather
    // than as misleading low-sample data points.
    const complete =
      expected > 0 &&
      !!h &&
      !!m &&
      h.n_poems >= expected &&
      m.n_poems >= expected;
    return {
      perf_slug: slug,
      perf_name: p.name as string,
      perf_date: (p.date as string) ?? null,
      perf_color: p.color as string,
      perf_status: p.status as string,
      pending: !hasData,
      n_themes_total: expected,
      complete,
    };
  });

  // Scoring progress: scored = sum of n_poems across all (perf, author) view
  // rows; total = sum of theme counts * 2 (halim + machine) across audience
  // perfs that have at least one author with data.
  let poemsScored = 0;
  for (const h of human) poemsScored += h.n_poems;
  for (const m of machine) poemsScored += m.n_poems;
  let poemsTotal = 0;
  themesByPerf.forEach((n) => {
    poemsTotal += n * 2;
  });
  const scoringComplete = poemsScored >= poemsTotal && poemsTotal > 0;

  return {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    performances,
    series: { human, machine },
    scoring_progress: {
      poems_scored: poemsScored,
      poems_total: poemsTotal,
      complete: scoringComplete,
    },
  };
}

export async function GET() {
  const data = await loadTrajectory();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
