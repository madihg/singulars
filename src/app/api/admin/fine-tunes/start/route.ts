/**
 * POST /api/admin/fine-tunes/start (US-123)
 *
 * Body fields match the kickoff form. Server-side flow:
 *   1. Build training-data JSONL via lib/training-data.
 *   2. Upload to chosen provider (uploadFile).
 *   3. Kick off the fine-tune job (startJob).
 *   4. Insert fine_tune_jobs row with status='queued', provider_job_id, file_id.
 *   5. Pre-create candidate_models row (archived=false, is_public=false) and
 *      link it via auto_registered_candidate_id. api_endpoint will be filled
 *      by the webhook on success.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";
import {
  buildExport,
  DEFAULT_SYSTEM_PROMPT,
  TrainingFormat,
} from "@/lib/training-data";
import {
  getProviderClient,
  FinetuneProvider,
  PROVIDER_SUPPORTS_DPO,
} from "@/lib/finetune-providers";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const provider = body?.provider as FinetuneProvider;
  const baseModel = body?.base_model as string;
  const format = body?.training_format as TrainingFormat;
  const sourcePerfSlugs = body?.source_performance_slugs as
    | string[]
    | undefined;
  const holdoutPerfSlug = (body?.holdout_performance_slug as string) || null;
  const candidateName = body?.candidate_name as string;
  const systemPrompt = (body?.system_prompt as string) || DEFAULT_SYSTEM_PROMPT;
  const hyperparameters =
    (body?.hyperparameters as Record<string, unknown>) || {};

  if (!provider || !baseModel || !format || !candidateName) {
    return NextResponse.json(
      {
        error: "provider, base_model, training_format, candidate_name required",
      },
      { status: 400 },
    );
  }
  if (!Array.isArray(sourcePerfSlugs) || sourcePerfSlugs.length === 0) {
    return NextResponse.json(
      { error: "source_performance_slugs must be a non-empty array" },
      { status: 400 },
    );
  }
  if (format === "dpo" && !PROVIDER_SUPPORTS_DPO[provider]) {
    return NextResponse.json(
      { error: `${provider} does not support DPO` },
      { status: 400 },
    );
  }

  const client = getProviderClient(provider);
  if (!client.hasKey()) {
    return NextResponse.json(
      { error: `provider ${provider} api key not set` },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  // Resolve performance slugs -> IDs
  const { data: perfs } = await supabase
    .from("performances")
    .select("id, slug")
    .in("slug", sourcePerfSlugs);
  const sourceIds = (perfs ?? []).map((p) => p.id as string);
  let holdoutIds: string[] = [];
  if (holdoutPerfSlug) {
    const { data: hp } = await supabase
      .from("performances")
      .select("id")
      .eq("slug", holdoutPerfSlug)
      .maybeSingle();
    if (hp) holdoutIds = [hp.id as string];
  }

  // Build JSONL
  const exportResult = await buildExport(supabase, {
    format,
    systemPrompt,
    performanceSlugs: sourcePerfSlugs,
    holdoutPerformanceSlug: holdoutPerfSlug,
  });

  if (exportResult.rows === 0) {
    return NextResponse.json(
      { error: "no training rows after holdout / exclusions" },
      { status: 400 },
    );
  }

  // Upload + start
  let providerFileId = "";
  let providerJobId = "";
  try {
    const upload = await client.uploadFile(
      exportResult.jsonl,
      `singulars-${format}-${Date.now()}.jsonl`,
    );
    providerFileId = upload.fileId;
    const start = await client.startJob({
      fileId: providerFileId,
      baseModel,
      format,
      hyperparameters,
      candidateName,
    });
    providerJobId = start.jobId;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `provider error: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Pre-create candidate_models row
  const candidateSlug = slugify(candidateName);
  const candidateColor = "#888";
  const { data: candidateRow } = await supabase
    .from("candidate_models")
    .insert({
      name: candidateName,
      slug: candidateSlug,
      family:
        provider === "openai"
          ? "gpt"
          : provider === "together"
            ? "llama"
            : "other",
      color: candidateColor,
      is_public: false,
      archived: false,
      notes: `auto-registered fine-tune via ${provider}`,
    })
    .select()
    .single();

  // Insert fine_tune_jobs row
  const userHash = userHashFromRequest(req) || "unknown";
  const { data: job, error: insErr } = await supabase
    .from("fine_tune_jobs")
    .insert({
      provider,
      base_model: baseModel,
      training_format: format,
      system_prompt: systemPrompt,
      source_performance_ids: sourceIds,
      holdout_performance_ids: holdoutIds,
      n_training_rows: exportResult.rows,
      hyperparameters,
      provider_job_id: providerJobId,
      provider_file_id: providerFileId,
      status: "queued",
      auto_registered_candidate_id: candidateRow?.id,
      triggered_by_user: userHash,
      training_data_snapshot: {
        rows: exportResult.rows,
        approx_tokens: exportResult.approxTokens,
      },
    })
    .select()
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  audit({
    audit: "fine_tune.start",
    by: userHash,
    job_id: job?.id,
    provider,
    base_model: baseModel,
    format,
    candidate_name: candidateName,
    n_training_rows: exportResult.rows,
  });

  return NextResponse.json({ id: job?.id });
}
