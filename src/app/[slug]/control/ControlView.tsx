"use client";

import { useCallback, useEffect, useState } from "react";

type Phase = "pre-show" | "writing" | "poems" | "vote" | "result";
const PHASES: Phase[] = ["pre-show", "writing", "poems", "vote", "result"];

interface StageStateRow {
  performance_id: string;
  phase: Phase;
  theme: string | null;
  theme_slug: string | null;
  human_poem: string;
  machine_poem: string;
  window_seconds: number;
  writing_starts_at: string | null;
  porto_tz: string;
  video_embed_url: string | null;
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ControlView({
  performance,
  initialState,
  controlKey,
}: {
  performance: PerformanceRow;
  initialState: StageStateRow | null;
  controlKey: string;
}) {
  const [state, setState] = useState<StageStateRow | null>(initialState);
  const [theme, setTheme] = useState(initialState?.theme ?? "");
  const [humanPoem, setHumanPoem] = useState(initialState?.human_poem ?? "");
  const [machinePoem, setMachinePoem] = useState(
    initialState?.machine_poem ?? "",
  );
  const [videoUrl, setVideoUrl] = useState(initialState?.video_embed_url ?? "");
  const [windowSeconds, setWindowSeconds] = useState(
    initialState?.window_seconds ?? 1800,
  );
  const [writingStartsAt, setWritingStartsAt] = useState(
    initialState?.writing_starts_at
      ? new Date(initialState.writing_starts_at).toISOString().slice(0, 16)
      : "",
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Light polling so the operator sees state changes (e.g. from a second
  // tab or a teammate). 3s is plenty.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/stage/${performance.slug}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.stage) setState(data.stage as StageStateRow);
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(t);
  }, [performance.slug]);

  const post = useCallback(
    async (patch: Partial<StageStateRow>, label: string) => {
      setSaving(label);
      setError(null);
      try {
        const res = await fetch(
          `/api/stage/${performance.slug}/update?key=${encodeURIComponent(controlKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "save failed");
        }
        // Optimistic local merge — the next poll will reconcile.
        setState((s) =>
          s ? ({ ...s, ...patch, updated_at: new Date().toISOString() } as StageStateRow) : s,
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(null);
      }
    },
    [controlKey, performance.slug],
  );

  const setPhase = useCallback(
    (p: Phase) => post({ phase: p }, `phase:${p}`),
    [post],
  );

  // Start the writing window NOW: stamp writing_starts_at=now and flip to
  // 'writing'. The stage computes the countdown from this timestamp so the
  // venue screen and this laptop stay in sync across the network.
  const startWritingNow = useCallback(
    () =>
      post(
        { phase: "writing", writing_starts_at: new Date().toISOString() },
        "start-writing",
      ),
    [post],
  );

  // Keyboard shortcuts: 1-5 for phases, Cmd/Ctrl+L focuses video field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable);
      if (inField) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter") {
          // Cmd+Enter inside a textarea saves that field
          const id = target?.getAttribute("data-field");
          if (id === "human_poem") {
            e.preventDefault();
            post({ human_poem: humanPoem }, "human_poem");
          } else if (id === "machine_poem") {
            e.preventDefault();
            post({ machine_poem: machinePoem }, "machine_poem");
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        document.getElementById("video-url-input")?.focus();
        return;
      }
      const idx = ["1", "2", "3", "4", "5"].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        setPhase(PHASES[idx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPhase, post, humanPoem, machinePoem]);

  const accent = performance.color;
  const monoFont = '"Diatype Mono Variable", monospace';

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2rem",
        fontFamily: '"Standard", sans-serif',
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h1
          style={{
            fontFamily: '"Terminal Grotesque", sans-serif',
            fontSize: "3rem",
            margin: 0,
            color: accent,
          }}
        >
          {performance.name} · control
        </h1>
        <a
          href={`/${performance.slug}/stage`}
          target="_blank"
          rel="noreferrer"
          style={{ fontFamily: monoFont, fontSize: "0.85rem", color: accent }}
        >
          open stage ↗
        </a>
      </header>

      {/* Phase pill row */}
      <section style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(0,0,0,0.5)",
            marginBottom: "0.5rem",
          }}
        >
          phase ( press 1–5 )
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {PHASES.map((p, i) => {
            const active = state?.phase === p;
            return (
              <button
                key={p}
                onClick={() => setPhase(p)}
                style={{
                  padding: "0.5rem 1rem",
                  border: `1px solid ${active ? accent : "rgba(0,0,0,0.15)"}`,
                  background: active ? accent : "transparent",
                  color: active ? "#fff" : "rgba(0,0,0,0.85)",
                  fontFamily: monoFont,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                  textTransform: "lowercase",
                }}
              >
                {i + 1}. {p}
              </button>
            );
          })}
        </div>

        {/* Start-the-clock action: stamps the writing window start so the
            stage timer counts down from now, synced across devices. */}
        <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={startWritingNow}
            disabled={saving === "start-writing"}
            style={{
              padding: "0.6rem 1.1rem",
              border: `1px solid ${accent}`,
              background: accent,
              color: "#fff",
              fontFamily: monoFont,
              fontSize: "0.9rem",
              cursor: saving === "start-writing" ? "wait" : "pointer",
              letterSpacing: "0.03em",
              textTransform: "lowercase",
            }}
          >
            {saving === "start-writing"
              ? "starting…"
              : `▶ start writing window now (${Math.round(windowSeconds / 60)} min)`}
          </button>
          <span style={{ fontFamily: monoFont, fontSize: "0.75rem", color: "rgba(0,0,0,0.45)" }}>
            stamps the timer start; the stage counts down from this moment.
          </span>
        </div>
      </section>

      {/* Two-column body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Field label="video embed url (Cmd/Ctrl+L)" hint="Daily.co / Whereby / Twitch / YouTube Live embed URL">
            <input
              id="video-url-input"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              style={inputStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ video_embed_url: videoUrl }, "video_embed_url")}
                saving={saving === "video_embed_url"}
                accent={accent}
              >
                save video url
              </SaveBtn>
            </RowActions>
          </Field>

          <Field label="theme">
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="enter theme…"
              style={inputStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ theme, theme_slug: slugify(theme) }, "theme")}
                saving={saving === "theme"}
                accent={accent}
              >
                lock theme
              </SaveBtn>
            </RowActions>
          </Field>

          <Field
            label="writing starts at (local time)"
            hint="for the pre-show countdown on the stage"
          >
            <input
              type="datetime-local"
              value={writingStartsAt}
              onChange={(e) => setWritingStartsAt(e.target.value)}
              style={inputStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() =>
                  post(
                    {
                      writing_starts_at: writingStartsAt
                        ? new Date(writingStartsAt).toISOString()
                        : null,
                    },
                    "writing_starts_at",
                  )
                }
                saving={saving === "writing_starts_at"}
                accent={accent}
              >
                save start time
              </SaveBtn>
            </RowActions>
          </Field>

          <Field label="window length (seconds)">
            <input
              type="number"
              value={windowSeconds}
              onChange={(e) => setWindowSeconds(Number(e.target.value))}
              style={inputStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ window_seconds: windowSeconds }, "window_seconds")}
                saving={saving === "window_seconds"}
                accent={accent}
              >
                save window
              </SaveBtn>
            </RowActions>
          </Field>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Field label="human poem (Cmd/Ctrl+Enter to save)">
            <textarea
              data-field="human_poem"
              value={humanPoem}
              onChange={(e) => setHumanPoem(e.target.value)}
              rows={8}
              style={textareaStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ human_poem: humanPoem }, "human_poem")}
                saving={saving === "human_poem"}
                accent={accent}
              >
                save human poem
              </SaveBtn>
            </RowActions>
          </Field>

          <Field label="machine poem (paste from /chat)">
            <textarea
              data-field="machine_poem"
              value={machinePoem}
              onChange={(e) => setMachinePoem(e.target.value)}
              rows={8}
              style={textareaStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ machine_poem: machinePoem }, "machine_poem")}
                saving={saving === "machine_poem"}
                accent={accent}
              >
                save machine poem
              </SaveBtn>
            </RowActions>
          </Field>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1rem",
            border: "1px solid #dc2626",
            color: "#dc2626",
            fontFamily: monoFont,
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Stage preview iframe */}
      <section style={{ marginTop: "2.5rem" }}>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(0,0,0,0.5)",
            marginBottom: "0.5rem",
          }}
        >
          stage preview (static mode)
        </div>
        <iframe
          src={`/${performance.slug}/stage?static=1`}
          style={{
            width: "100%",
            height: 480,
            border: `1px solid ${accent}`,
            background: "#000",
          }}
          title="stage preview"
        />
      </section>

      <footer
        style={{
          marginTop: "2rem",
          fontFamily: monoFont,
          fontSize: "0.75rem",
          color: "rgba(0,0,0,0.4)",
          lineHeight: 1.6,
        }}
      >
        shortcuts: 1–5 phase · Cmd/Ctrl+L video url · Cmd/Ctrl+Enter save textarea
        <br />
        last updated: {state?.updated_at ? new Date(state.updated_at).toLocaleTimeString() : "—"}
      </footer>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.6)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </div>
      {hint && (
        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(0,0,0,0.45)",
            marginBottom: "0.4rem",
          }}
        >
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
      {children}
    </div>
  );
}

function SaveBtn({
  onClick,
  saving,
  accent,
  children,
}: {
  onClick: () => void;
  saving: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: "0.4rem 0.85rem",
        border: `1px solid ${accent}`,
        background: "transparent",
        color: accent,
        fontFamily: '"Diatype Mono Variable", monospace',
        fontSize: "0.8rem",
        cursor: saving ? "wait" : "pointer",
        letterSpacing: "0.03em",
        textTransform: "lowercase",
      }}
    >
      {saving ? "saving…" : children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  border: "1px solid rgba(0,0,0,0.15)",
  fontFamily: '"Diatype Mono Variable", monospace',
  fontSize: "0.9rem",
  background: "transparent",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "1px solid rgba(0,0,0,0.15)",
  fontFamily: '"Standard", sans-serif',
  fontSize: "0.95rem",
  lineHeight: 1.6,
  background: "transparent",
  outline: "none",
  resize: "vertical",
};
