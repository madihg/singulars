/**
 * POST /api/admin/eval-runs/[id]/publish (US-112)
 *
 * Body: { published?: boolean } - if omitted, toggles current value.
 * Side effect: revalidates the eval-results cache tag so the public chart
 * refreshes within seconds.
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: cur, error: gErr } = await supabase
    .from("eval_runs")
    .select("id, published")
    .eq("id", params.id)
    .maybeSingle();
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
  if (!cur) return NextResponse.json({ error: "not found" }, { status: 404 });

  const next =
    typeof body?.published === "boolean" ? body.published : !cur.published;

  const { data, error } = await supabase
    .from("eval_runs")
    .update({ published: next })
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    revalidateTag("eval-results");
  } catch {
    /* tag may not be registered yet */
  }

  audit({
    audit: "eval_run.publish",
    by: userHashFromRequest(req),
    id: params.id,
    old: cur.published,
    new: next,
  });

  return NextResponse.json({ run: data });
}
