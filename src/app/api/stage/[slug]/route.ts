import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/stage/[slug]
 * Read the current stage_state for a performance. Public (anon-readable);
 * used by the venue screen polling loop and by ?static=1 fallback render.
 */
export async function GET(
  _req: Request,
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

  return NextResponse.json(
    { performance: perf, stage: state ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
