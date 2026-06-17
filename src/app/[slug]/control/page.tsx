import { notFound } from "next/navigation";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import ControlView from "./ControlView";

export const dynamic = "force-dynamic";

/**
 * /[slug]/control — operator surface. The performer opens this on their
 * laptop with ?key=... matching STAGE_CONTROL_KEY. We do the key check
 * server-side so the page itself 404s when unauthorized. The actual
 * mutating endpoint also re-checks the key on each request.
 */
export default async function ControlPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { key?: string };
}) {
  const expected = process.env.STAGE_CONTROL_KEY;
  if (!expected || !searchParams.key || searchParams.key !== expected) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "4rem 2rem",
          fontFamily: '"Diatype Mono Variable", monospace',
          color: "rgba(0,0,0,0.6)",
        }}
      >
        <p>unauthorized.</p>
        <p style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
          append <code>?key=…</code> with the STAGE_CONTROL_KEY value.
        </p>
      </main>
    );
  }

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
    <ControlView
      performance={perf}
      initialState={state}
      controlKey={searchParams.key}
    />
  );
}
