/**
 * GET /api/evals/themes?model=<slug>&perf=<slug> (US-116)
 *
 * Public, RLS-gated. Returns the latest published completed run's per-theme
 * rows joined with the audience-winner poem text.
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modelSlug = url.searchParams.get("model");
  const perfSlug = url.searchParams.get("perf");
  if (!modelSlug || !perfSlug) {
    return NextResponse.json(
      { error: "model and perf query params required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase() || getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase unavailable" },
      { status: 500 },
    );
  }

  // RLS-gated: anon only sees published+completed runs.
  const { data: viewRow } = await supabase
    .from("v_model_winrate_per_performance")
    .select("eval_run_id, model_slug, performance_slug")
    .eq("model_slug", modelSlug)
    .eq("performance_slug", perfSlug)
    .maybeSingle();
  if (!viewRow) {
    return NextResponse.json({ error: "no published run" }, { status: 404 });
  }

  const { data: scores } = await supabase
    .from("eval_scores")
    .select(
      "theme_slug, candidate_text, candidate_won, confidence, judge_rationale",
    )
    .eq("eval_run_id", viewRow.eval_run_id);

  // Audience-winner text via RPC
  const { data: tuples } = await supabase.rpc("golden_tuples_for_performance", {
    p_slug: perfSlug,
  });
  type Tuple = {
    theme_slug: string;
    theme: string;
    winner_text: string;
    winner_type: string;
  };
  const byTheme: Record<string, Tuple> = {};
  for (const t of (tuples ?? []) as Tuple[]) byTheme[t.theme_slug] = t;

  const themes = (scores ?? []).map((s) => {
    const g = byTheme[s.theme_slug as string];
    return {
      theme: g?.theme || s.theme_slug,
      theme_slug: s.theme_slug,
      audience_winner_text: g?.winner_text || null,
      audience_winner_type: g?.winner_type || null,
      candidate_text: s.candidate_text,
      candidate_won: s.candidate_won,
      confidence: s.confidence,
      judge_rationale: s.judge_rationale,
    };
  });

  return NextResponse.json({
    model_slug: modelSlug,
    performance_slug: perfSlug,
    themes,
  });
}
