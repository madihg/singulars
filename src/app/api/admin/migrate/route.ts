import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "singulars-migrate-2026-03-10-v3") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 503 });
  }

  // Create a fresh client with singulars schema
  const supabase = createClient(url, serviceKey, {
    db: { schema: "singulars" },
  });

  const results: Record<string, unknown> = {};

  // Step 1: Read current statuses
  const { data: before } = await supabase
    .from("performances")
    .select("slug, status, location, num_poems")
    .in("slug", ["hard-exe", "reverse-exe"]);
  results["before"] = before;

  // Step 2: Update hard.exe
  const hardRes = await supabase
    .from("performances")
    .update({ status: "trained" })
    .eq("slug", "hard-exe")
    .select();
  results["hard-update"] = {
    data: hardRes.data,
    error: hardRes.error?.message || null,
    count: hardRes.data?.length ?? 0,
    status: hardRes.status,
    statusText: hardRes.statusText,
  };

  // Step 3: Update reverse.exe
  const revRes = await supabase
    .from("performances")
    .update({
      status: "training",
      location: "Media Archaeology Lab, Boulder",
      num_poems: 6,
      num_poets: 1,
    })
    .eq("slug", "reverse-exe")
    .select();
  results["reverse-update"] = {
    data: revRes.data,
    error: revRes.error?.message || null,
    count: revRes.data?.length ?? 0,
    status: revRes.status,
    statusText: revRes.statusText,
  };

  // Step 4: Read statuses AFTER update (fresh query)
  const { data: after } = await supabase
    .from("performances")
    .select("slug, status, location, num_poems")
    .in("slug", ["hard-exe", "reverse-exe"]);
  results["after"] = after;

  // Step 5: Also check poems count
  const { data: revPerf } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", "reverse-exe")
    .single();
  if (revPerf) {
    const { data: poems } = await supabase
      .from("poems")
      .select("id, theme, author_type")
      .eq("performance_id", revPerf.id);
    results["reverse-poems"] = { count: poems?.length ?? 0, poems };
  }

  return NextResponse.json(results);
}
