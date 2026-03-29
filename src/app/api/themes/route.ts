import { NextResponse } from "next/server";
import { getServiceClient, getSupabase } from "@/lib/supabase";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** GET /api/themes - list all non-archived themes sorted by votes desc */
export async function GET() {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("themes")
    .select("id, content, theme_slug, votes, completed, created_at, updated_at")
    .eq("archived", false)
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/** POST /api/themes - create a new theme suggestion */
export async function POST(req: Request) {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json(
      { error: "Theme content is required" },
      { status: 400 },
    );
  }

  if (content.length > 50) {
    return NextResponse.json(
      { error: "Theme must be 50 characters or less" },
      { status: 400 },
    );
  }

  const theme_slug = slugify(content);

  const { data, error } = await supabase
    .from("themes")
    .insert({ content, theme_slug })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This theme already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
