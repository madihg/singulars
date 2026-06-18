import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PRESENCE_WINDOW_SECONDS = 15; // a viewer "counts" if seen within this window

/**
 * GET /api/stage/[slug]?viewer=<id>
 * Read the current stage_state for a performance. Public (anon-readable);
 * used by the venue screen polling loop and by ?static=1 fallback render.
 *
 * If `viewer` is passed (the stage screen sends a stable per-tab id on each
 * poll), we upsert a presence heartbeat and return `viewer_count` = how many
 * distinct viewers were seen in the last PRESENCE_WINDOW_SECONDS. Also returns
 * `rounds`: the completed theme pairs with their vote tallies.
 */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: perf, error: perfError } = await supabase
    .from("performances")
    .select("id, slug, name, color, status, date, location")
    .eq("slug", params.slug)
    .single();

  if (perfError || !perf) {
    return NextResponse.json(
      { error: "Performance not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: state, error: stateError } = await supabase
    .from("stage_state")
    .select("*")
    .eq("performance_id", perf.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json(
      { error: "Could not load stage state" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Presence heartbeat + live viewer count. Best-effort: never fail the main
  // response if presence bookkeeping errors.
  const viewerId = new URL(req.url).searchParams.get("viewer");
  let viewerCount = 0;
  try {
    if (viewerId) {
      await supabase.from("stage_presence").upsert(
        {
          performance_id: perf.id,
          viewer_id: viewerId,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "performance_id,viewer_id" },
      );
    }
    const cutoff = new Date(
      Date.now() - PRESENCE_WINDOW_SECONDS * 1000,
    ).toISOString();
    const { count } = await supabase
      .from("stage_presence")
      .select("*", { count: "exact", head: true })
      .eq("performance_id", perf.id)
      .gte("last_seen", cutoff);
    viewerCount = count ?? 0;
  } catch {
    viewerCount = 0;
  }

  // Completed rounds (materialized poem pairs) with tallies.
  type Round = {
    theme: string;
    theme_slug: string;
    human_votes: number;
    machine_votes: number;
    total: number;
  };
  let rounds: Round[] = [];
  try {
    const { data: poems } = await supabase
      .from("poems")
      .select("theme, theme_slug, author_type, vote_count")
      .eq("performance_id", perf.id);
    const byTheme: Record<string, Round> = {};
    for (const p of (poems ?? []) as Array<{
      theme: string;
      theme_slug: string;
      author_type: string;
      vote_count: number;
    }>) {
      const r =
        byTheme[p.theme_slug] ??
        (byTheme[p.theme_slug] = {
          theme: p.theme,
          theme_slug: p.theme_slug,
          human_votes: 0,
          machine_votes: 0,
          total: 0,
        });
      if (p.author_type === "human") r.human_votes = p.vote_count ?? 0;
      else if (p.author_type === "machine") r.machine_votes = p.vote_count ?? 0;
      r.total = r.human_votes + r.machine_votes;
    }
    rounds = Object.values(byTheme);
  } catch {
    rounds = [];
  }

  return NextResponse.json(
    {
      performance: perf,
      stage: state ?? null,
      viewer_count: viewerCount,
      rounds,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
