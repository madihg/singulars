/**
 * POST /api/admin/fine-tunes/webhooks/together (US-122)
 *
 * Verifies Together's HMAC signature, updates the matching fine_tune_jobs row
 * by provider_job_id, and auto-fills candidate api_endpoint on succeeded.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";
import { getProviderClient } from "@/lib/finetune-providers";

export const dynamic = "force-dynamic";

function verify(body: string, sig: string | null, secret: string): boolean {
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
  const raw = await req.text();
  const sig = req.headers.get("x-together-signature");
  const secret = process.env.TOGETHER_WEBHOOK_SECRET || "";
  if (secret && !verify(raw, sig, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false });
  }
  const jobId = payload.id as string | undefined;
  if (!jobId) return NextResponse.json({ ok: true, ignored: "no jobId" });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false });

  const s = (payload.status as string) || "running";
  const status =
    s === "completed"
      ? "succeeded"
      : s === "failed"
        ? "failed"
        : s === "cancelled"
          ? "cancelled"
          : s === "queued"
            ? "queued"
            : "running";

  const update: Record<string, unknown> = { status };
  if (status === "succeeded") {
    update.output_model_id = (payload.output_name as string) || null;
    update.finished_at = new Date().toISOString();
  }
  if (status === "failed") {
    update.error_message = (payload.error as string) || "unknown";
    update.finished_at = new Date().toISOString();
  }

  const { data: jobRow } = await supabase
    .from("fine_tune_jobs")
    .update(update)
    .eq("provider_job_id", jobId)
    .select()
    .single();

  if (jobRow && status === "succeeded" && jobRow.auto_registered_candidate_id) {
    const endpoint = getProviderClient("together").promptfooEndpoint(
      jobRow.output_model_id,
    );
    await supabase
      .from("candidate_models")
      .update({ api_endpoint: endpoint })
      .eq("id", jobRow.auto_registered_candidate_id);
  }

  return NextResponse.json({ ok: true });
}
