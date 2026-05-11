/**
 * GET /api/evals/classifier-gap
 *
 * Per (performance, classifier) gap between Halim and the machine, computed
 * from retroactively-judged archived poems. Powers the classifier gap
 * heatmap on /evolution - shows WHERE the gap lives across the 7 audience-
 * derived classifiers, and how it evolves per dimension across the series.
 *
 * Reads singulars.v_classifier_gap_per_perf (anon-readable).
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";
import {
  ACTIVE_CLASSIFIERS,
  ACTIVE_CLASSIFIERS_VERSION,
} from "@/lib/audience-classifiers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Cell = {
  perf_slug: string;
  classifier_id: string;
  halim_avg: number;
  machine_avg: number;
  gap: number;
  halim_n: number;
  machine_n: number;
};

type Body = {
  classifiers_version: string;
  classifiers: Array<{ id: string; name: string; weight: number }>;
  performances: Array<{
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
  }>;
  cells: Cell[];
};

async function loadGap(): Promise<Body> {
  const supabase = getSupabase() || getServiceClient();
  const emptyResp: Body = {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    classifiers: ACTIVE_CLASSIFIERS.classifiers.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
    })),
    performances: [],
    cells: [],
  };
  if (!supabase) return emptyResp;

  const { data: rows } = await supabase
    .from("v_classifier_gap_per_perf")
    .select(
      "perf_slug, perf_name, perf_date, perf_color, classifier_id, halim_avg, machine_avg, gap, halim_n, machine_n",
    );

  type RawRow = {
    perf_slug: string;
    perf_name: string;
    perf_date: string | null;
    perf_color: string;
    classifier_id: string;
    halim_avg: string | number;
    machine_avg: string | number;
    gap: string | number;
    halim_n: number;
    machine_n: number;
  };

  const perfSet = new Map<
    string,
    {
      perf_slug: string;
      perf_name: string;
      perf_date: string | null;
      perf_color: string;
    }
  >();
  const cells: Cell[] = [];
  for (const r of (rows ?? []) as RawRow[]) {
    if (!perfSet.has(r.perf_slug)) {
      perfSet.set(r.perf_slug, {
        perf_slug: r.perf_slug,
        perf_name: r.perf_name,
        perf_date: r.perf_date,
        perf_color: r.perf_color,
      });
    }
    cells.push({
      perf_slug: r.perf_slug,
      classifier_id: r.classifier_id,
      halim_avg: Number(r.halim_avg) || 0,
      machine_avg: Number(r.machine_avg) || 0,
      gap: Number(r.gap) || 0,
      halim_n: r.halim_n || 0,
      machine_n: r.machine_n || 0,
    });
  }

  const performances = Array.from(perfSet.values()).sort((a, b) =>
    (a.perf_date || "").localeCompare(b.perf_date || ""),
  );

  return {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    classifiers: ACTIVE_CLASSIFIERS.classifiers.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
    })),
    performances,
    cells,
  };
}

export async function GET() {
  const data = await loadGap();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
