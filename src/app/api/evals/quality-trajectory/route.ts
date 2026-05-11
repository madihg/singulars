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
  }>;
  series: {
    human: TrajectoryPoint[];
    machine: TrajectoryPoint[];
  };
};

async function loadTrajectory(): Promise<Body> {
  const supabase = getSupabase() || getServiceClient();
  if (!supabase) {
    return {
      classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
      performances: [],
      series: { human: [], machine: [] },
    };
  }

  const { data: viewRows } = await supabase
    .from("v_machine_quality_trajectory")
    .select(
      "perf_slug, perf_name, perf_date, perf_color, perf_status, author_type, avg_score, stddev_score, n_poems",
    );

  const { data: perfs } = await supabase
    .from("performances")
    .select("slug, name, date, color, status")
    .order("date", { ascending: true, nullsFirst: false });

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

  const performances = (perfs ?? []).map((p) => {
    const slug = p.slug as string;
    const hasData =
      human.some((h) => h.perf_slug === slug) ||
      machine.some((m) => m.perf_slug === slug);
    return {
      perf_slug: slug,
      perf_name: p.name as string,
      perf_date: (p.date as string) ?? null,
      perf_color: p.color as string,
      perf_status: p.status as string,
      pending: !hasData,
    };
  });

  return {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    performances,
    series: { human, machine },
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
