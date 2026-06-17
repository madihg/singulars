import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * POST /api/stage/[slug]/update
 * Key-gated operator write. Body is a partial of stage_state — merged into
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
  const expected = process.env.STAGE_CONTROL_KEY;

  if (!expected) {
    return NextResponse.json(
      { error: "STAGE_CONTROL_KEY not configured on server" },
      { status: 503 },
    );
  }
  if (!key || key !== expected) {
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

  // Side-effect: when phase enters 'poems' for the first time, materialize
  // both poems into singulars.poems so the audience voting page works.
  if (patch.phase === "poems") {
    const { data: latest } = await supabase
      .from("stage_state")
      .select("theme, theme_slug, human_poem, machine_poem")
      .eq("performance_id", perf.id)
      .single();

    if (latest?.theme_slug && latest.human_poem && latest.machine_poem) {
      const { data: existing } = await supabase
        .from("poems")
        .select("id, author_type")
        .eq("performance_id", perf.id)
        .eq("theme_slug", latest.theme_slug);

      const haveHuman = existing?.some((p) => p.author_type === "human");
      const haveMachine = existing?.some((p) => p.author_type === "machine");

      const rows: Array<Record<string, unknown>> = [];
      if (!haveHuman) {
        rows.push({
          performance_id: perf.id,
          theme: latest.theme,
          theme_slug: latest.theme_slug,
          text: latest.human_poem,
          author_name: "Halim Madi",
          author_type: "human",
          vote_count: 0,
        });
      }
      if (!haveMachine) {
        rows.push({
          performance_id: perf.id,
          theme: latest.theme,
          theme_slug: latest.theme_slug,
          text: latest.machine_poem,
          author_name: "Machine",
          author_type: "machine",
          vote_count: 0,
        });
      }
      if (rows.length > 0) {
        await supabase.from("poems").insert(rows);
      }
    }
  }

  // Side-effect: 'vote' phase opens public voting; anything else after
  // 'vote' (i.e. 'result') closes it. The /[slug]/[themeSlug] page already
  // honors performance.status === 'training' as "voting open".
  if (patch.phase === "vote" && perf.status !== "training") {
    await supabase
      .from("performances")
      .update({ status: "training" })
      .eq("id", perf.id);
  } else if (patch.phase === "result" && perf.status === "training") {
    await supabase
      .from("performances")
      .update({ status: "trained" })
      .eq("id", perf.id);
  }

  return NextResponse.json({ success: true });
}
