import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

/**
 * POST /api/stage/[slug]/answer - PUBLIC (no operator key).
 *
 * The venue stage screen is unauthenticated, but it must write its WebRTC
 * SDP answer back so the operator (control) can complete the camera
 * connection. This endpoint ONLY accepts `webrtc_answer` and writes nothing
 * else, so the blast radius is limited to the live-camera handshake (worst
 * case: a bogus answer disrupts the video, recoverable by toggling the
 * camera). All other stage mutations stay behind the key-gated /update.
 */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const answer = body?.webrtc_answer;
  if (typeof answer !== "string" || answer.length === 0 || answer.length > 200000) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const { data: perf, error: perfError } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", params.slug)
    .single();
  if (perfError || !perf) {
    return NextResponse.json({ error: "Performance not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("stage_state")
    .update({ webrtc_answer: answer })
    .eq("performance_id", perf.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
