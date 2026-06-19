import { notFound } from "next/navigation";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import StageView from "./StageView";

export const dynamic = "force-dynamic";

/**
 * /[slug]/stage - the fullscreen surface the venue puts on a screen in
 * the room. Server-renders the initial state from Supabase so the page is
 * usable instantly (and as a graceful `?static=1` fallback when polling is
 * blocked). The <StageView> client child handles the 2-second poll loop
 * + the localStorage cache.
 */

interface StageStateRow {
  performance_id: string;
  phase: "pre-show" | "writing" | "break";
  theme: string | null;
  theme_slug: string | null;
  human_poem: string;
  machine_poem: string;
  window_seconds: number;
  writing_starts_at: string | null;
  porto_tz: string;
  video_embed_url: string | null;
  break_message: string | null;
  camera_on: boolean;
  webrtc_offer: string | null;
  webrtc_answer: string | null;
  sandbox: boolean;
  published_theme: string | null;
  published_theme_slug: string | null;
  published_human_poem: string | null;
  published_machine_poem: string | null;
  updated_at: string;
}

interface PerformanceRow {
  id: string;
  slug: string;
  name: string;
  color: string;
  status: "upcoming" | "training" | "trained";
  date: string;
  location: string;
}

export default async function StagePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { static?: string };
}) {
  const supabase = getServiceClient() || getSupabase();
  if (!supabase) notFound();

  const { data: perf } = await supabase
    .from("performances")
    .select("id, slug, name, color, status, date, location")
    .eq("slug", params.slug)
    .single();

  if (!perf) notFound();

  const { data: state } = await supabase
    .from("stage_state")
    .select("*")
    .eq("performance_id", perf.id)
    .maybeSingle();

  return (
    <StageView
      performance={perf as PerformanceRow}
      initialState={state as StageStateRow | null}
      staticMode={searchParams.static === "1"}
    />
  );
}
