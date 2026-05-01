/**
 * GET /api/admin/eval-runs/[id] (US-108)
 *
 * Returns the run detail joined with model + performance, plus the per-theme
 * eval_scores rows joined with the audience-winner poem text from the source
 * performance (so the detail page can render side-by-side blocks without a
 * second round-trip).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
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

  const { data: run, error: rErr } = await supabase
    .from("eval_runs")
    .select(
      "*, candidate_model:candidate_models(*), performance:performances(*)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: scores, error: sErr } = await supabase
    .from("eval_scores")
    .select("*")
    .eq("eval_run_id", params.id)
    .order("theme_slug");
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Join with the audience winner poem text per theme.
  type RunRow = { performance: { id: string } | null };
  const perfId = (run as unknown as RunRow).performance?.id;
  let golden: Array<{
    theme_slug: string;
    winner_text: string;
    winner_type: string;
    loser_text: string;
    loser_type: string;
  }> = [];
  if (perfId) {
    type PerfSlugRow = { performance: { slug: string } | null };
    const perfSlug = (run as unknown as PerfSlugRow).performance?.slug;
    if (perfSlug) {
      const { data: tuples } = await supabase.rpc(
        "golden_tuples_for_performance",
        { p_slug: perfSlug },
      );
      golden = (tuples ?? []) as typeof golden;
    }
  }
  const goldenByTheme: Record<string, (typeof golden)[number]> = {};
  for (const g of golden) goldenByTheme[g.theme_slug] = g;

  const enrichedScores = (scores ?? []).map((s) => {
    const g = goldenByTheme[s.theme_slug as string];
    return {
      ...s,
      audience_winner_text: g?.winner_text ?? null,
      audience_winner_type: g?.winner_type ?? null,
      audience_loser_text: g?.loser_text ?? null,
      audience_loser_type: g?.loser_type ?? null,
    };
  });

  return NextResponse.json({ run, scores: enrichedScores });
}
