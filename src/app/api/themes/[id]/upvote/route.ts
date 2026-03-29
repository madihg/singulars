import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

/** POST /api/themes/[id]/upvote - atomically increment vote count */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("upvote_theme", {
    p_theme_id: params.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 404 });
  }

  return NextResponse.json({ data });
}
