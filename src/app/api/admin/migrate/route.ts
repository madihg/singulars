import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient, getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "singulars-migrate-2026-03-10-v4") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const results: Record<string, unknown> = {};
  results["env"] = {
    hasUrl: !!url,
    hasServiceKey: !!serviceKey,
    urlPrefix: url.substring(0, 30),
  };

  // Client 1: Fresh client (same as v3)
  const fresh = createClient(url, serviceKey, {
    db: { schema: "singulars" },
  });

  // Client 2: Singleton service client (used by API routes)
  const singleton = getServiceClient();

  // Client 3: Singleton anon client
  const anon = getSupabase();

  results["clients"] = {
    freshOk: !!fresh,
    singletonOk: !!singleton,
    anonOk: !!anon,
  };

  // Read from ALL three clients
  const slugs = ["hard-exe", "reverse-exe"];

  const { data: freshData } = await fresh
    .from("performances")
    .select("slug, status, location, num_poems")
    .in("slug", slugs);
  results["fresh-read"] = freshData;

  if (singleton) {
    const { data: singletonData } = await singleton
      .from("performances")
      .select("slug, status, location, num_poems")
      .in("slug", slugs);
    results["singleton-read"] = singletonData;
  }

  if (anon) {
    const { data: anonData, error: anonErr } = await anon
      .from("performances")
      .select("slug, status, location, num_poems")
      .in("slug", slugs);
    results["anon-read"] = anonErr ? { error: anonErr.message } : anonData;
  }

  // Do the updates using the SINGLETON client (same one the API uses)
  if (singleton) {
    const { data: h, error: he } = await singleton
      .from("performances")
      .update({ status: "trained" })
      .eq("slug", "hard-exe")
      .select("slug, status");
    results["singleton-hard-update"] = he ? { error: he.message } : h;

    const { data: r, error: re } = await singleton
      .from("performances")
      .update({
        status: "training",
        location: "Media Archaeology Lab, Boulder",
        num_poems: 6,
        num_poets: 1,
      })
      .eq("slug", "reverse-exe")
      .select("slug, status, location, num_poems");
    results["singleton-reverse-update"] = re ? { error: re.message } : r;

    // Re-read after update with singleton
    const { data: afterData } = await singleton
      .from("performances")
      .select("slug, status, location, num_poems")
      .in("slug", slugs);
    results["singleton-after"] = afterData;
  }

  return NextResponse.json(results);
}
