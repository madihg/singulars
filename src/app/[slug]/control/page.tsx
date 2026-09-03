import { notFound } from "next/navigation";
import { getServiceClient, getSupabase } from "@/lib/supabase";
import { isStageControlKeyValid } from "@/lib/stage-auth";
import { isValidAdminCookieFromStore } from "@/lib/admin-auth";
import ControlView from "./ControlView";
import KeyPrompt from "./KeyPrompt";
import BodyClass from "@/components/desktop/BodyClass";

export const dynamic = "force-dynamic";

/**
 * /[slug]/control - operator surface. The performer opens this on their
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
  // Authorized via ?key= (STAGE_CONTROL_KEY or admin password) OR an active
  // /admin login cookie (so the link from /admin just works).
  const authed =
    isStageControlKeyValid(searchParams.key) || isValidAdminCookieFromStore();
  if (!authed) {
    const triedKey =
      typeof searchParams.key === "string" && searchParams.key.length > 0;
    return (
      <>
        {/* The operator console is venue furniture: no menu bar, no footer,
            no dotted ground. */}
        <BodyClass className="bare" />
        <main className="desk desk--tight">
          <section className="win w--five">
            <div className="win__bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <h1 className="win__t">{params.slug} · control</h1>
            </div>
            <div className="win__b">
              {triedKey ? (
                <p className="sg-err" style={{ marginTop: 0 }}>
                  That key did not match. Try again.
                </p>
              ) : null}
              <KeyPrompt />
            </div>
          </section>
        </main>
      </>
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
    <>
      <BodyClass className="bare" />
      <ControlView
        performance={perf}
        initialState={state}
        controlKey={searchParams.key ?? ""}
      />
    </>
  );
}
