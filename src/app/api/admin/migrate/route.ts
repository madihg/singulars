import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "singulars-votes-2026-03-10") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, {
    db: { schema: "singulars" },
    global: {
      fetch: (u: RequestInfo | URL, o?: RequestInit) =>
        fetch(u, { ...o, cache: "no-store" as RequestCache }),
    },
  });

  const results: Record<string, unknown> = {};

  // Get hard-exe performance ID
  const { data: perf } = await supabase
    .from("performances")
    .select("id")
    .eq("slug", "hard-exe")
    .single();

  if (!perf) {
    return NextResponse.json({ error: "hard-exe not found" }, { status: 404 });
  }

  // Get all hard-exe poems
  const { data: poems } = await supabase
    .from("poems")
    .select("id, theme_slug, author_type, vote_count")
    .eq("performance_id", perf.id);

  results["before"] = poems;

  // CORRECTION: Previous migration used wrong values.
  // Set absolute correct totals (online votes + correct offline votes).
  // Online votes before any migration: particles H:2,M:0 / sun H:0,M:1 / diegetic H:1,M:0 / romance H:0,M:0
  // Correct offline: particles H:3,M:1 / sun H:34,M:14 / romance H:35,M:38 / diegetic H:20,M:8
  const correctTotals: Record<string, Record<string, number>> = {
    particles: { human: 5, machine: 1 },
    sun: { human: 34, machine: 15 },
    romance: { human: 35, machine: 38 },
    diegetic: { human: 21, machine: 8 },
  };

  const updates: Array<{
    id: string;
    theme: string;
    author: string;
    oldCount: number;
    newTotal: number;
  }> = [];

  for (const poem of poems || []) {
    const themeTotals = correctTotals[poem.theme_slug];
    if (!themeTotals) continue;
    const correctTotal = themeTotals[poem.author_type];
    if (correctTotal === undefined) continue;
    if (correctTotal === poem.vote_count) continue;

    const { error } = await supabase
      .from("poems")
      .update({ vote_count: correctTotal })
      .eq("id", poem.id);

    updates.push({
      id: poem.id,
      theme: poem.theme_slug,
      author: poem.author_type,
      oldCount: poem.vote_count,
      newTotal: correctTotal,
    });

    if (error) {
      results[`error-${poem.theme_slug}-${poem.author_type}`] = error.message;
    }
  }

  results["updates"] = updates;

  // Verify
  const { data: after } = await supabase
    .from("poems")
    .select("id, theme_slug, author_type, vote_count")
    .eq("performance_id", perf.id);
  results["after"] = after;

  return NextResponse.json(results);
}
