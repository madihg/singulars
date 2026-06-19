/**
 * /admin/control - per-performance control hub.
 *
 * The operator surfaces (control + stage) live per performance at
 * /<slug>/control and /<slug>/stage. This page is the entry point into them
 * from inside admin: it highlights whatever performance is currently in
 * `training` ("live now") and lists every performance with its own
 * control/stage links, so when a future show goes live it shows up here
 * automatically - nothing hard-coded to recover.exe.
 *
 * Control accepts the admin login cookie, so these links open without a ?key.
 */

import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";
import {
  FONT_MONO,
  FONT_DISPLAY,
  sectionHeadingStyle,
  statCardStyle,
  statusPillStyle,
} from "@/lib/admin-styles";

export const dynamic = "force-dynamic";

type Perf = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  status: "upcoming" | "training" | "trained";
  date: string;
};

async function fetchData(): Promise<{ perfs: Perf[]; withStage: Set<string> }> {
  const supabase = getServiceClient();
  if (!supabase) return { perfs: [], withStage: new Set() };

  const { data: perfs } = await supabase
    .from("performances")
    .select("id, slug, name, color, status, date")
    .order("date", { ascending: false });

  const { data: stageRows } = await supabase
    .from("stage_state")
    .select("performance_id");

  const withStage = new Set(
    ((stageRows || []) as { performance_id: string }[]).map(
      (r) => r.performance_id,
    ),
  );

  return { perfs: (perfs || []) as Perf[], withStage };
}

function ControlLinks({
  slug,
  accent,
}: {
  slug: string;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
      <Link
        href={`/${slug}/control`}
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
          textDecoration: "none",
          color: "#fff",
          background: accent,
          border: `1px solid ${accent}`,
          borderRadius: "6px",
          padding: "0.4rem 0.8rem",
        }}
      >
        open control →
      </Link>
      <a
        href={`/${slug}/stage`}
        target="_blank"
        rel="noreferrer"
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
          textDecoration: "none",
          color: "var(--text-primary)",
          border: "1px solid var(--border-light)",
          borderRadius: "6px",
          padding: "0.4rem 0.8rem",
        }}
      >
        open stage ↗
      </a>
    </div>
  );
}

export default async function AdminControlPage() {
  const { perfs, withStage } = await fetchData();
  const live = perfs.filter((p) => p.status === "training");
  const accentOf = (p: Perf) => p.color || "var(--text-primary)";

  return (
    <div>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "4rem",
          lineHeight: 0.9,
          fontWeight: 400,
          margin: "0 0 0.5rem 0",
        }}
      >
        control
      </h1>
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: "0.95rem",
          color: "var(--text-secondary)",
          margin: "0 0 2.5rem 0",
        }}
      >
        drive a performance&rsquo;s live stage: lock themes, publish poems, run
        the camera. open control on your laptop, open the stage on the venue
        screen.
      </p>

      <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>live now</h2>
      {live.length > 0 ? (
        <div style={{ display: "grid", gap: "1rem", marginBottom: "2.5rem" }}>
          {live.map((p) => (
            <div
              key={p.id}
              style={{
                ...statCardStyle,
                borderColor: accentOf(p),
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: "1.75rem",
                    color: accentOf(p),
                    marginBottom: "0.4rem",
                  }}
                >
                  {p.name}
                </div>
                <span style={statusPillStyle("training")}>training</span>
              </div>
              <ControlLinks slug={p.slug} accent={accentOf(p)} />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            ...statCardStyle,
            fontFamily: FONT_MONO,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            marginBottom: "2.5rem",
          }}
        >
          no performance is in &lsquo;training&rsquo; right now. flip one to
          training (on{" "}
          <Link href="/admin/performances" style={{ color: "var(--text-primary)" }}>
            performances
          </Link>
          ) to drive its stage.
        </div>
      )}

      <h2 style={{ ...sectionHeadingStyle, marginBottom: "1rem" }}>
        all performances
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {perfs.map((p) => (
          <div
            key={p.id}
            style={{
              ...statCardStyle,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem 1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                }}
              >
                {p.name}
              </span>
              <span style={statusPillStyle(p.status)}>{p.status}</span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: "0.72rem",
                  color: "var(--text-hint)",
                }}
              >
                {withStage.has(p.id) ? "stage ready" : "no stage yet"}
              </span>
            </div>
            <ControlLinks slug={p.slug} accent={accentOf(p)} />
          </div>
        ))}
      </div>
    </div>
  );
}
