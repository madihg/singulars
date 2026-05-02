/**
 * POST /api/admin/fine-tunes/[id]/retry (US-124)
 *
 * Re-submits a failed job with the same params (new row).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export async function POST(
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

  const { data: src } = await supabase
    .from("fine_tune_jobs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Resolve perf ids back to slugs to feed into /start route logic
  const { data: perfs } = await supabase
    .from("performances")
    .select("id, slug")
    .in("id", src.source_performance_ids as string[]);
  const slugs = (perfs ?? []).map((p) => p.slug as string);
  const { data: holdoutPerfs } = await supabase
    .from("performances")
    .select("slug")
    .in("id", src.holdout_performance_ids as string[]);
  const holdout = (holdoutPerfs ?? [])[0]?.slug || null;

  const url = new URL(req.url);
  const startUrl = `${url.origin}/api/admin/fine-tunes/start`;
  const res = await fetch(startUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body: JSON.stringify({
      provider: src.provider,
      base_model: src.base_model,
      training_format: src.training_format,
      source_performance_slugs: slugs,
      holdout_performance_slug: holdout,
      candidate_name: `retry of ${src.id.slice(0, 8)}`,
      system_prompt: src.system_prompt,
      hyperparameters: src.hyperparameters || {},
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: j?.error || "retry failed" },
      { status: 500 },
    );
  }
  const j = await res.json();
  return NextResponse.json({ id: j.id });
}
