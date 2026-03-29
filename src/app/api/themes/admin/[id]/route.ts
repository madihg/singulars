import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { isValidAdminCookie } from "../auth/route";

const COOKIE_NAME = "theme-admin-token";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function requireAuth(): NextResponse | null {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!isValidAdminCookie(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** PUT /api/themes/admin/[id] - edit theme content */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const authError = requireAuth();
  if (authError) return authError;

  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length > 50) {
    return NextResponse.json(
      { error: "Theme must be between 1 and 50 characters" },
      { status: 400 },
    );
  }

  const theme_slug = slugify(content);

  const { data, error } = await supabase
    .from("themes")
    .update({ content, theme_slug, updated_at: new Date().toISOString() })
    .eq("id", params.id)
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

  if (!data) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

/** DELETE /api/themes/admin/[id] - permanently delete theme */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const authError = requireAuth();
  if (authError) return authError;

  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { error } = await supabase.from("themes").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
