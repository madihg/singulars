import { notFound } from "next/navigation";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { isStageControlKeyValid } from "@/lib/stage-auth";
import ControlView from "./ControlView";
import KeyPrompt from "./KeyPrompt";

export const dynamic = "force-dynamic";

/**
 * /[slug]/control — operator surface. The performer opens this on their
 * laptop with ?key=... matching STAGE_CONTROL_KEY or the admin password. We
 * do the key check server-side so the page itself gates when unauthorized.
 * The actual mutating endpoint also re-checks the key on each request.
 */
export default async function ControlPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { key?: string };
}) {
  if (!isStageControlKeyValid(searchParams.key)) {
    const triedKey =
      typeof searchParams.key === "string" && searchParams.key.length > 0;
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "4rem 2rem",
          fontFamily: '"Diatype Mono Variable", monospace',
          color: "rgba(0,0,0,0.85)",
        }}
      >
        <h1
          style={{
            fontFamily: '"Terminal Grotesque", sans-serif',
            fontSize: "2rem",
            fontWeight: 400,
            margin: "0 0 1.5rem 0",
          }}
        >
          {params.slug} · control
        </h1>
        {triedKey ? (
          <p style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            that key didn&apos;t match. try again.
          </p>
        ) : null}
        <KeyPrompt />
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
      controlKey={searchParams.key as string}
    />
  );
}
