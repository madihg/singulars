/**
 * GET /api/admin/cron/check-trained (US-119)
 *
 * Vercel cron entry. Looks up performances where status='trained' AND no
 * eval_runs row with status='completed' exists from the last 24h. If found
 * AND ADMIN_NIGHTLY_EMAIL env is set, sends a single notification email.
 * If env not set, no-ops silently.
 *
 * Authed by Vercel's cron header check (x-vercel-cron header presence).
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel sets `user-agent: vercel-cron/1.0` and `x-vercel-cron`. We accept
  // either header to allow local testing via curl with `x-vercel-cron: 1`.
  const isVercelCron =
    req.headers.get("x-vercel-cron") === "1" ||
    req.headers.get("user-agent")?.startsWith("vercel-cron");
  if (!isVercelCron) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase unavailable" });
  }

  // Trained performances
  const { data: trained } = await supabase
    .from("performances")
    .select("id, name, slug")
    .eq("status", "trained");

  if (!trained || trained.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, sent: 0 });
  }

  // Has any completed run in the last 24h?
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("eval_runs")
    .select("performance_id")
    .eq("status", "completed")
    .gte("finished_at", since);
  const haveRecentRun = new Set((recent ?? []).map((r) => r.performance_id));

  const needNotify = trained.filter((p) => !haveRecentRun.has(p.id));
  const email = process.env.ADMIN_NIGHTLY_EMAIL;
  if (!email || needNotify.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: trained.length,
      sent: 0,
      reason: !email ? "ADMIN_NIGHTLY_EMAIL not set" : "no perf needs notify",
    });
  }

  // Send via Resend if configured. Otherwise log a warning.
  let sent = 0;
  for (const p of needNotify) {
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from:
              process.env.ADMIN_NIGHTLY_FROM || "watcher@singulars.oulipo.xyz",
            to: email,
            subject: `[singulars] ${p.name} is ready to evaluate`,
            text: `open https://singulars.oulipo.xyz/admin/eval-runs/new?performance=${p.slug} to run it.\n\n- the watcher`,
          }),
        });
        sent += 1;
      } catch {
        // swallow - cron should not fail
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          notify: "would_email",
          to: email,
          performance: p.slug,
          reason: "RESEND_API_KEY not set",
        }),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    checked: trained.length,
    notify: needNotify.length,
    sent,
  });
}
