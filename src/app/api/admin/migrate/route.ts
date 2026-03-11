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

  // Offline vote tallies to ADD to existing counts
  // Particles had 2 sessions: (H:3,M:1) + (H:35,M:38)
  const offlineVotes: Record<string, Record<string, number>> = {
    particles: { human: 38, machine: 39 },
    sun: { human: 34, machine: 14 },
    diegetic: { human: 20, machine: 8 },
    romance: { human: 0, machine: 0 },
  };

  // Update each poem's vote_count by adding offline votes
  const updates: Array<{
    id: string;
    theme: string;
    author: string;
    added: number;
    newTotal: number;
  }> = [];

  for (const poem of poems || []) {
    const themeVotes = offlineVotes[poem.theme_slug];
    if (!themeVotes) continue;
    const toAdd = themeVotes[poem.author_type] || 0;
    if (toAdd === 0) continue;

    const newTotal = (poem.vote_count || 0) + toAdd;
    const { error } = await supabase
      .from("poems")
      .update({ vote_count: newTotal })
      .eq("id", poem.id);

    updates.push({
      id: poem.id,
      theme: poem.theme_slug,
      author: poem.author_type,
      added: toAdd,
      newTotal,
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
