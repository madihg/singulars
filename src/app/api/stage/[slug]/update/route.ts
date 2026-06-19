import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isStageControlKeyValid } from "@/lib/stage-auth";
import { isValidAdminCookie } from "@/lib/admin-auth";

/**
 * POST /api/stage/[slug]/update
 * Key-gated operator write. Body is a partial of stage_state - merged into
 * the row + updated_at=now(). Also handles the side-effect of inserting
 * poems rows on first phase transition past 'poems' (the audience voting
 * page reuses singulars.poems), and flipping performances.status between
 * 'training' and 'trained' when phase enters/leaves 'vote'.
 */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  // Authorized via ?key= or an active /admin login cookie.
  if (!isStageControlKeyValid(key) && !isValidAdminCookie(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }

  const { data: perf, error: perfError } = await supabase
    .from("performances")
    .select("id, slug, status")
    .eq("slug", params.slug)
    .single();

  if (perfError || !perf) {
    return NextResponse.json(
      { error: "Performance not found" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const allowed = [
    "phase",
    "theme",
    "theme_slug",
    "human_poem",
    "machine_poem",
    "window_seconds",
    "writing_starts_at",
    "video_embed_url",
    "break_message",
    "camera_on",
    "webrtc_offer",
    "webrtc_answer",
    "sandbox",
    "published_theme",
    "published_theme_slug",
    "published_human_poem",
    "published_machine_poem",
  ] as const;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  const { error: updateError } = await supabase
    .from("stage_state")
    .update(patch)
    .eq("performance_id", perf.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update stage state: " + updateError.message },
      { status: 500 },
    );
  }

  // Side-effect: when a pair is PUBLISHED (published_* set) and we're live
  // (not sandbox), materialize it into singulars.poems so it appears on the
  // performance page + is votable, and open voting (status='training').
  // The published_* snapshot is what the stage shows; the draft theme/poems
  // (theme/human_poem/machine_poem) drive the camera + the operator's
  // working area only. In sandbox, the pair shows on the stage but is never
  // committed (dry-runs don't pollute the tallies).
  const { data: latest } = await supabase
    .from("stage_state")
    .select(
      "published_theme, published_theme_slug, published_human_poem, published_machine_poem, sandbox",
    )
    .eq("performance_id", perf.id)
    .single();

  if (
    !latest?.sandbox &&
    latest?.published_theme_slug &&
    latest.published_human_poem &&
    latest.published_machine_poem
  ) {
    const { data: existing } = await supabase
      .from("poems")
      .select("id, author_type")
      .eq("performance_id", perf.id)
      .eq("theme_slug", latest.published_theme_slug);

    const haveHuman = existing?.some((p) => p.author_type === "human");
    const haveMachine = existing?.some((p) => p.author_type === "machine");

    const rows: Array<Record<string, unknown>> = [];
    if (!haveHuman) {
      rows.push({
        performance_id: perf.id,
        theme: latest.published_theme,
        theme_slug: latest.published_theme_slug,
        text: latest.published_human_poem,
        author_name: "Halim Madi",
        author_type: "human",
        vote_count: 0,
      });
    }
    if (!haveMachine) {
      rows.push({
        performance_id: perf.id,
        theme: latest.published_theme,
        theme_slug: latest.published_theme_slug,
        text: latest.published_machine_poem,
        author_name: "Machine",
        author_type: "machine",
        vote_count: 0,
      });
    }
    if (rows.length > 0) {
      await supabase.from("poems").insert(rows);
    }
    if (perf.status !== "training") {
      await supabase
        .from("performances")
        .update({ status: "training" })
        .eq("id", perf.id);
    }
  }

  return NextResponse.json({ success: true });
}
