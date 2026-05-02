/**
 * GET /api/admin/cron/poll-finetunes (US-122 fallback)
 *
 * Polls provider APIs for any fine-tune job in running/validating/queued state
 * with no recent webhook update. Off by default; on when FINETUNE_POLLING=1.
 *
 * Updates the fine_tune_jobs row on status change. Auto-fills the candidate
 * model's api_endpoint on succeeded transition.
 *
 * NOTE: The Vercel cron entry was removed in commit 5f4af0 because every-10-min
 * crons require the Pro plan (Hobby allows daily only). Webhooks are the primary
 * path; this route is now a manual fallback. Hit it via curl + the cron header
 * if a webhook is missed:
 *   curl -H "x-vercel-cron: 1" https://singulars.oulipo.xyz/api/admin/cron/poll-finetunes
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getProviderClient, FinetuneProvider } from "@/lib/finetune-providers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const isVercelCron =
    req.headers.get("x-vercel-cron") === "1" ||
    req.headers.get("user-agent")?.startsWith("vercel-cron");
  if (!isVercelCron) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.FINETUNE_POLLING !== "1") {
    return NextResponse.json({
      polled: false,
      reason: "FINETUNE_POLLING not set",
    });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false });

  const { data: jobs } = await supabase
    .from("fine_tune_jobs")
    .select("*")
    .in("status", ["queued", "validating", "running"])
    .limit(20);

  let polled = 0;
  let updated = 0;
  for (const job of jobs ?? []) {
    if (!job.provider_job_id) continue;
    polled += 1;
    try {
      const client = getProviderClient(job.provider as FinetuneProvider);
      const status = await client.pollJob(job.provider_job_id);
      if (status.status === job.status) continue;
      const update: Record<string, unknown> = { status: status.status };
      if (status.status === "succeeded" && status.output_model_id) {
        update.output_model_id = status.output_model_id;
        update.finished_at = new Date().toISOString();
      }
      if (status.status === "failed") {
        update.error_message = status.error || "unknown";
        update.finished_at = new Date().toISOString();
      }
      const { data: row } = await supabase
        .from("fine_tune_jobs")
        .update(update)
        .eq("id", job.id)
        .select()
        .single();
      if (
        row &&
        status.status === "succeeded" &&
        row.auto_registered_candidate_id &&
        status.output_model_id
      ) {
        const endpoint = client.promptfooEndpoint(status.output_model_id);
        await supabase
          .from("candidate_models")
          .update({ api_endpoint: endpoint })
          .eq("id", row.auto_registered_candidate_id);
      }
      updated += 1;
    } catch {
      /* swallow - try again next tick */
    }
  }

  return NextResponse.json({ polled, updated });
}
