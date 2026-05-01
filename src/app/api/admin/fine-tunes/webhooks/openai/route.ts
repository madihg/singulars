/**
 * POST /api/admin/fine-tunes/webhooks/openai (US-122)
 *
 * Verifies OpenAI-Webhook-Signature, parses event, updates the matching
 * fine_tune_jobs row by provider_job_id. Auto-registers the candidate model's
 * api_endpoint on succeeded.
 *
 * Public endpoint (signature-verified). Rate-limited via simple in-memory
 * counter; failures log + return 200 to avoid retry floods.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";
import { getProviderClient } from "@/lib/finetune-providers";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const calls: number[] = [];

function checkRate(): boolean {
  const now = Date.now();
  while (calls.length > 0 && calls[0] < now - RATE_WINDOW_MS) calls.shift();
  if (calls.length >= RATE_LIMIT) return false;
  calls.push(now);
  return true;
}

function verifyOpenAISig(
  body: string,
  sig: string | null,
  secret: string,
): boolean {
  if (!sig || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(sig.replace(/^sha256=/, "")),
  );
}

export async function POST(req: Request) {
  if (!checkRate()) return NextResponse.json({ ok: false, ratelimited: true });

  const raw = await req.text();
  const sig = req.headers.get("openai-webhook-signature");
  const secret = process.env.OPENAI_WEBHOOK_SECRET || "";
  if (secret && !verifyOpenAISig(raw, sig, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, parse: "fail" });
  }

  const data = (payload.data || payload) as Record<string, unknown>;
  const jobId = (data.id as string) || (data.fine_tuning_job_id as string);
  if (!jobId) return NextResponse.json({ ok: true, ignored: "no jobId" });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "no supabase" });

  const status = mapOpenAIStatus(data.status as string);
  const update: Record<string, unknown> = { status };
  if (status === "succeeded" && data.fine_tuned_model) {
    update.output_model_id = data.fine_tuned_model;
    update.finished_at = new Date().toISOString();
  }
  if (status === "failed") {
    update.error_message =
      (data.error as { message?: string })?.message || "unknown";
    update.finished_at = new Date().toISOString();
  }

  const { data: jobRow } = await supabase
    .from("fine_tune_jobs")
    .update(update)
    .eq("provider_job_id", jobId)
    .select()
    .single();

  // On success, fill the candidate_models api_endpoint
  if (jobRow && status === "succeeded" && jobRow.auto_registered_candidate_id) {
    const endpoint = getProviderClient("openai").promptfooEndpoint(
      jobRow.output_model_id,
    );
    await supabase
      .from("candidate_models")
      .update({ api_endpoint: endpoint })
      .eq("id", jobRow.auto_registered_candidate_id);
  }

  return NextResponse.json({ ok: true });
}

function mapOpenAIStatus(s: string | undefined): string {
  const map: Record<string, string> = {
    validating_files: "validating",
    queued: "queued",
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    cancelled: "cancelled",
  };
  return map[s || ""] || "running";
}
