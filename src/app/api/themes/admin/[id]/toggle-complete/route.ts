import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { isValidAdminCookie } from "../../auth/route";

const COOKIE_NAME = "theme-admin-token";

/** PATCH /api/themes/admin/[id]/toggle-complete */
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!isValidAdminCookie(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient() || getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from("themes")
    .select("id, completed")
    .eq("id", params.id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  // Toggle
  const { data, error } = await supabase
    .from("themes")
    .update({
      completed: !current.completed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
