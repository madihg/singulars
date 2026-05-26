import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

/**
 * POST /api/vote/undo
 * Body: { poem_id, fingerprint }
 *
 * Removes the caller's vote on a poem pair so they can re-vote. Only
 * permitted while the performance is in status='training'. Deletes the
 * matching row from singulars.votes and decrements poems.vote_count by 1.
 *
 * Pre-baked tallies (paper ballots) are unaffected — we only decrement by
 * one and we only touch the specific poem the user actually voted on.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FINGERPRINT_LENGTH = 255;

export async function POST(request: Request) {
  try {
    const supabase = getServiceClient() || getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { poem_id, fingerprint } = body;

    if (!poem_id || !fingerprint) {
      return NextResponse.json(
        { error: "Missing required fields: poem_id and fingerprint" },
        { status: 400 },
      );
    }

    if (typeof poem_id !== "string" || !UUID_REGEX.test(poem_id)) {
      return NextResponse.json(
        { error: "Invalid poem_id format" },
        { status: 400 },
      );
    }

    if (
      typeof fingerprint !== "string" ||
      fingerprint.length > MAX_FINGERPRINT_LENGTH ||
      /<[^>]*>/.test(fingerprint)
    ) {
      return NextResponse.json(
        { error: "Invalid fingerprint" },
        { status: 400 },
      );
    }

    const { data: poem, error: poemError } = await supabase
      .from("poems")
      .select("id, performance_id, theme_slug, vote_count")
      .eq("id", poem_id)
      .single();

    if (poemError || !poem) {
      return NextResponse.json({ error: "Poem not found" }, { status: 404 });
    }

    const { data: performance, error: perfError } = await supabase
      .from("performances")
      .select("id, status")
      .eq("id", poem.performance_id)
      .single();

    if (perfError || !performance) {
      return NextResponse.json(
        { error: "Performance not found" },
        { status: 404 },
      );
    }

    if (performance.status !== "training") {
      return NextResponse.json(
        {
          error:
            "Voting is closed for this performance. Cannot undo a finalized vote.",
        },
        { status: 403 },
      );
    }

    // Find the exact vote row for this fingerprint on this poem.
    const { data: existing, error: lookupError } = await supabase
      .from("votes")
      .select("id")
      .eq("voter_fingerprint", fingerprint)
      .eq("poem_id", poem_id)
      .limit(1);

    if (lookupError) {
      return NextResponse.json(
        { error: "Something went wrong. Please try again later." },
        { status: 500 },
      );
    }

    if (!existing || existing.length === 0) {
      return NextResponse.json(
        { error: "No vote found to undo for this fingerprint on this poem." },
        { status: 404 },
      );
    }

    // Delete the vote row.
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("id", existing[0].id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Could not undo vote. Please try again later." },
        { status: 500 },
      );
    }

    // Decrement vote_count by 1 (clamped at 0 for safety).
    const newCount = Math.max(0, (poem.vote_count ?? 1) - 1);
    const { error: updateError } = await supabase
      .from("poems")
      .update({ vote_count: newCount })
      .eq("id", poem_id);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "Vote row deleted but count not updated. Refresh the page to see correct tally.",
        },
        { status: 500 },
      );
    }

    // Fetch updated pair so the client can re-render both columns.
    const { data: updatedPair } = await supabase
      .from("poems")
      .select("id, vote_count")
      .eq("performance_id", poem.performance_id)
      .eq("theme_slug", poem.theme_slug);

    const vote_counts = (updatedPair || []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p.vote_count }),
      {} as Record<string, number>,
    );

    return NextResponse.json({
      success: true,
      message: "Vote undone. You can now vote again.",
      vote_counts,
    });
  } catch (err: unknown) {
    console.error(
      "Unexpected error in vote/undo API:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
    );
  }
}
