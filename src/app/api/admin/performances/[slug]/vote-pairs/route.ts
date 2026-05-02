/**
 * GET /api/admin/performances/[slug]/vote-pairs (US-113, US-104)
 *
 * Returns one row per theme for this performance, with both poems (human +
 * machine) and their current vote_counts. Powers the vote-entry table.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Poem = {
  id: string;
  text: string;
  author_name: string;
  vote_count: number;
};

type ThemeRow = {
  theme: string;
  theme_slug: string;
  human: Poem | null;
  machine: Poem | null;
};

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: perf, error: pErr } = await supabase
    .from("performances")
    .select("id, slug, name, status")
    .eq("slug", params.slug)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!perf) {
    return NextResponse.json(
      { error: "performance not found" },
      { status: 404 },
    );
  }

  const { data: poems, error: poemErr } = await supabase
    .from("poems")
    .select("id, theme, theme_slug, text, author_name, author_type, vote_count")
    .eq("performance_id", perf.id);
  if (poemErr) {
    return NextResponse.json({ error: poemErr.message }, { status: 500 });
  }

  const byTheme = new Map<string, ThemeRow>();
  for (const p of poems ?? []) {
    const slug = p.theme_slug as string;
    if (!byTheme.has(slug)) {
      byTheme.set(slug, {
        theme: p.theme as string,
        theme_slug: slug,
        human: null,
        machine: null,
      });
    }
    const row = byTheme.get(slug)!;
    const poem: Poem = {
      id: p.id as string,
      text: p.text as string,
      author_name: (p.author_name as string) || "",
      vote_count: (p.vote_count as number) || 0,
    };
    if (p.author_type === "human") row.human = poem;
    else if (p.author_type === "machine") row.machine = poem;
  }

  const themes = Array.from(byTheme.values()).sort((a, b) =>
    a.theme_slug.localeCompare(b.theme_slug),
  );

  return NextResponse.json({
    performance: {
      id: perf.id,
      slug: perf.slug,
      name: perf.name,
      status: perf.status,
    },
    themes,
  });
}
