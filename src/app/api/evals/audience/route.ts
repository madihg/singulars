/**
 * GET /api/evals/audience
 *
 * Per-performance live-show audience truth: how many themes the room awarded
 * to Halim (human) vs the machine. Pure DB read - no LLM, no eval. This is
 * the headline "evolution" chart on /evolution: does the methodology
 * actually make the model evolve to beat Halim more often?
 *
 * Reads from singulars.v_audience_machine_vs_human (anon-readable view).
 * Performances with status='upcoming' that don't yet have poem pairs are
 * surfaced as `pending: true` rows with zero counts so the chart can show
 * a placeholder (e.g. ground.exe).
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AudienceRow = {
  perf_slug: string;
  perf_name: string;
  perf_date: string | null;
  perf_color: string;
  perf_status: string;
  n_themes: number;
  human_wins: number;
  machine_wins: number;
  ties: number;
  pending: boolean;
};

type Body = {
  performances: AudienceRow[];
  totals: {
    human_wins: number;
    machine_wins: number;
    ties: number;
    n_themes: number;
    machine_win_rate: number;
  };
};

async function loadAudience(): Promise<Body> {
  const supabase = getSupabase() || getServiceClient();
  if (!supabase) {
    return {
      performances: [],
      totals: {
        human_wins: 0,
        machine_wins: 0,
        ties: 0,
        n_themes: 0,
        machine_win_rate: 0,
      },
    };
  }

  // 1. View rows (one per performance that has at least one human/machine pair)
  const { data: viewRows } = await supabase
    .from("v_audience_machine_vs_human")
    .select(
      "perf_slug, perf_name, perf_date, perf_color, perf_status, n_themes, human_wins, machine_wins, ties",
    );

  // 2. All performances (so we can include upcoming ground.exe as pending)
  const { data: perfs } = await supabase
    .from("performances")
    .select("slug, name, date, color, status")
    .order("date", { ascending: true, nullsFirst: false });

  const byPerf = new Map<string, AudienceRow>();
  for (const r of (viewRows ?? []) as Omit<AudienceRow, "pending">[]) {
    byPerf.set(r.perf_slug, { ...r, pending: false });
  }

  const merged: AudienceRow[] = (perfs ?? [])
    // Hide ground.exe from the public chart until it's nearer (it's been
    // moved to Currents Santa Fe 2027). The DB row stays - this is a chart-
    // level filter.
    .filter((p) => p.slug !== "ground-exe")
    .map((p) => {
      const row = byPerf.get(p.slug as string);
      if (row) return row;
      // Performance exists but no audience pairs yet (e.g. an upcoming show).
      return {
        perf_slug: p.slug as string,
        perf_name: p.name as string,
        perf_date: (p.date as string) ?? null,
        perf_color: p.color as string,
        perf_status: p.status as string,
        n_themes: 0,
        human_wins: 0,
        machine_wins: 0,
        ties: 0,
        pending: true,
      };
    });

  const totals = merged.reduce(
    (acc, r) => {
      if (r.pending) return acc;
      acc.human_wins += r.human_wins;
      acc.machine_wins += r.machine_wins;
      acc.ties += r.ties;
      acc.n_themes += r.n_themes;
      return acc;
    },
    { human_wins: 0, machine_wins: 0, ties: 0, n_themes: 0 },
  );

  const machineWinRate =
    totals.n_themes > 0 ? totals.machine_wins / totals.n_themes : 0;

  return {
    performances: merged,
    totals: { ...totals, machine_win_rate: machineWinRate },
  };
}

export async function GET() {
  const data = await loadAudience();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
