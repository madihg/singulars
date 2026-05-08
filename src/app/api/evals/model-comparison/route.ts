/**
 * GET /api/evals/model-comparison
 *
 * Latest classifier-based eval per public model on reverse.exe (the held-out
 * test set). Returns per-model normalized score + per-classifier breakdown
 * pulled from raw_judge_payload.council_scores.
 *
 * Powers the middle chart on /evolution: which model best matches audience
 * taste under the new classifier-based methodology.
 */

import { NextResponse } from "next/server";
import { getSupabase, getServiceClient } from "@/lib/supabase";
import {
  ACTIVE_CLASSIFIERS,
  ACTIVE_CLASSIFIERS_VERSION,
  computeClassifierScore,
} from "@/lib/audience-classifiers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ModelComparisonRow = {
  slug: string;
  name: string;
  family: string;
  color: string;
  score: number; // 0-1, higher = better
  per_classifier: Record<string, number>; // mean council score per classifier 0-5
  n_themes: number;
  inter_rater_avg_stddev: number; // average across themes
  perf_slug: string;
};

type Body = {
  classifiers_version: string;
  classifiers: Array<{ id: string; name: string; weight: number }>;
  models: ModelComparisonRow[];
};

async function loadComparison(): Promise<Body> {
  const supabase = getSupabase() || getServiceClient();
  if (!supabase) {
    return {
      classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
      classifiers: ACTIVE_CLASSIFIERS.classifiers.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
      })),
      models: [],
    };
  }

  // 1. Public models
  const { data: models } = await supabase
    .from("candidate_models")
    .select("slug, name, family, color, is_public")
    .eq("is_public", true)
    .eq("archived", false)
    .order("name");

  // 2. Latest published completed run per (model, perf=reverse-exe) using the
  // existing view.
  const { data: latestRuns } = await supabase
    .from("v_model_winrate_per_performance")
    .select("model_slug, eval_run_id, performance_slug")
    .eq("performance_slug", "reverse-exe");

  const runIdByModel: Record<string, string> = {};
  for (const r of (latestRuns ?? []) as {
    model_slug: string;
    eval_run_id: string;
    performance_slug: string;
  }[]) {
    runIdByModel[r.model_slug] = r.eval_run_id;
  }

  const runIds = Object.values(runIdByModel);
  if (runIds.length === 0) {
    return {
      classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
      classifiers: ACTIVE_CLASSIFIERS.classifiers.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
      })),
      models: [],
    };
  }

  // 3. eval_scores rows for those runs - pull raw_judge_payload to get the
  // classifier breakdown.
  const { data: scores } = await supabase
    .from("eval_scores")
    .select("eval_run_id, theme_slug, raw_judge_payload")
    .in("eval_run_id", runIds);

  type ScoreRow = {
    eval_run_id: string;
    theme_slug: string;
    raw_judge_payload: {
      method?: string;
      council_scores?: Record<string, number>;
      inter_rater_avg_stddev?: number;
    } | null;
  };

  // Aggregate per-run: average each classifier across all themes in the run
  const perRunAgg: Record<
    string,
    {
      classifier_sums: Record<string, number>;
      classifier_counts: Record<string, number>;
      stddev_sum: number;
      stddev_count: number;
      n_themes: number;
    }
  > = {};
  for (const s of (scores ?? []) as ScoreRow[]) {
    const payload = s.raw_judge_payload;
    if (!payload) continue;
    if (!perRunAgg[s.eval_run_id]) {
      perRunAgg[s.eval_run_id] = {
        classifier_sums: {},
        classifier_counts: {},
        stddev_sum: 0,
        stddev_count: 0,
        n_themes: 0,
      };
    }
    const agg = perRunAgg[s.eval_run_id];
    agg.n_themes += 1;
    // Classifier scores from the council
    const cs = payload.council_scores;
    if (cs && typeof cs === "object") {
      for (const c of ACTIVE_CLASSIFIERS.classifiers) {
        const v = cs[c.id];
        if (typeof v === "number" && Number.isFinite(v)) {
          agg.classifier_sums[c.id] = (agg.classifier_sums[c.id] || 0) + v;
          agg.classifier_counts[c.id] = (agg.classifier_counts[c.id] || 0) + 1;
        }
      }
    }
    if (typeof payload.inter_rater_avg_stddev === "number") {
      agg.stddev_sum += payload.inter_rater_avg_stddev;
      agg.stddev_count += 1;
    }
  }

  const out: ModelComparisonRow[] = [];
  for (const m of (models ?? []) as {
    slug: string;
    name: string;
    family: string;
    color: string;
  }[]) {
    const runId = runIdByModel[m.slug];
    const agg = runId ? perRunAgg[runId] : undefined;
    if (!agg || agg.n_themes === 0) continue;
    const perClassifier: Record<string, number> = {};
    for (const c of ACTIVE_CLASSIFIERS.classifiers) {
      const sum = agg.classifier_sums[c.id] || 0;
      const cnt = agg.classifier_counts[c.id] || 0;
      if (cnt > 0) perClassifier[c.id] = sum / cnt;
    }
    const score = computeClassifierScore(perClassifier);
    out.push({
      slug: m.slug,
      name: m.name,
      family: m.family,
      color: m.color,
      score,
      per_classifier: perClassifier,
      n_themes: agg.n_themes,
      inter_rater_avg_stddev:
        agg.stddev_count > 0 ? agg.stddev_sum / agg.stddev_count : 0,
      perf_slug: "reverse-exe",
    });
  }

  out.sort((a, b) => b.score - a.score);
  return {
    classifiers_version: ACTIVE_CLASSIFIERS_VERSION,
    classifiers: ACTIVE_CLASSIFIERS.classifiers.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
    })),
    models: out,
  };
}

export async function GET() {
  const data = await loadComparison();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
