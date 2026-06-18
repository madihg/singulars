"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface StageStateRow {
  performance_id: string;
  phase: "pre-show" | "writing" | "poems" | "vote" | "result";
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

interface Props {
  performance: PerformanceRow;
  initialState: StageStateRow | null;
  staticMode: boolean;
}

const CACHE_KEY = (slug: string) => `singulars:stage:${slug}`;
const POLL_MS = 2000;
const MONO = '"Diatype Mono Variable", monospace';
const DISPLAY = '"Terminal Grotesque", sans-serif';

// The machine Halim battles at recover.exe.
const OPPONENT = "frontière";

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function StageView({
  performance,
  initialState,
  staticMode,
}: Props) {
  const [state, setState] = useState<StageStateRow | null>(() => {
    if (initialState) return initialState;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY(performance.slug));
      return raw ? (JSON.parse(raw) as StageStateRow) : null;
    } catch {
      return null;
    }
  });
  const [pollHealth, setPollHealth] = useState<"ok" | "degraded">("ok");
  const failCountRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !state) return;
    try {
      localStorage.setItem(CACHE_KEY(performance.slug), JSON.stringify(state));
    } catch {
      // quota / disabled storage — ignore
    }
  }, [state, performance.slug]);

  useEffect(() => {
    if (staticMode) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    async function tick() {
      if (stopped || document.hidden) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await fetch(`/api/stage/${performance.slug}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("non-ok");
        const data = await res.json();
        if (data.stage) setState(data.stage as StageStateRow);
        failCountRef.current = 0;
        setPollHealth("ok");
        timer = setTimeout(tick, POLL_MS);
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= 3) setPollHealth("degraded");
        const backoff = Math.min(30000, POLL_MS * 2 ** failCountRef.current);
        timer = setTimeout(tick, backoff);
      }
    }
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [performance.slug, staticMode]);

  const phase = state?.phase ?? "pre-show";
  const color = performance.color;

  // Stable anonymized order: seed by perf id so reloads don't flip A/B.
  const showHumanFirst = useMemo(() => {
    const seed = performance.id
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return seed % 2 === 0;
  }, [performance.id]);

  // QR always points at the poem-voting page for the current theme once it
  // exists; before that, the performance page (read about the piece). Never
  // the theme-suggestion page - theme suggestion now happens AFTER voting.
  const qrUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (state?.theme_slug)
      return `${origin}/${performance.slug}/${state.theme_slug}`;
    return `${origin}/${performance.slug}`;
  }, [performance.slug, state?.theme_slug]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "2.5rem",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        fontFamily: '"Standard", sans-serif',
      }}
      data-phase={phase}
    >
      {/* Header: title + "battling frontière" */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: "4.5rem",
              lineHeight: 0.9,
              fontWeight: 400,
              margin: 0,
              color,
            }}
          >
            {performance.name}
          </h1>
          <p
            style={{
              fontFamily: MONO,
              fontSize: "1rem",
              color: "rgba(255,255,255,0.7)",
              margin: "0.85rem 0 0 0",
              letterSpacing: "0.02em",
            }}
          >
            Halim is writing against{" "}
            <span style={{ color }}>{OPPONENT}</span> — a machine trained on
            his own poems.
          </p>
        </div>
      </header>

      {/* Body: main (poems / state) on the left, camera + QR on the right */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1.55fr 1fr",
          gap: "2rem",
        }}
      >
        {/* MAIN */}
        <section style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          {phase === "pre-show" ? (
            <PreShow
              writingStartsAt={state?.writing_starts_at ?? null}
              color={color}
            />
          ) : phase === "writing" ? (
            <WritingState theme={state?.theme ?? null} color={color} />
          ) : (
            <PoemsPair
              state={state}
              color={color}
              showHumanFirst={showHumanFirst}
              revealAuthorship={phase === "result"}
            />
          )}
        </section>

        {/* RIGHT: camera (top) + QR (below) */}
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            minHeight: 0,
          }}
        >
          <CameraTile
            videoUrl={state?.video_embed_url ?? null}
            theme={state?.theme ?? null}
            phase={phase}
            windowSeconds={state?.window_seconds ?? 1800}
            writingStartsAt={state?.writing_starts_at ?? null}
            color={color}
          />
          <QRBlock url={qrUrl} color={color} hasTheme={!!state?.theme_slug} />
        </aside>
      </div>

      {/* Polling-health dot */}
      {!staticMode && (
        <div
          aria-hidden
          title={pollHealth === "ok" ? "live" : "reconnecting…"}
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: pollHealth === "ok" ? color : "#f59e0b",
            opacity: 0.65,
          }}
        />
      )}
    </main>
  );
}

/* ---------- Camera tile with theme + timer overlays ---------- */

function CameraTile({
  videoUrl,
  theme,
  phase,
  windowSeconds,
  writingStartsAt,
  color,
}: {
  videoUrl: string | null;
  theme: string | null;
  phase: string;
  windowSeconds: number;
  writingStartsAt: string | null;
  color: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 10",
        background: "#0a0a0a",
        border: `1px solid ${color}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {videoUrl ? (
        <iframe
          src={videoUrl}
          allow="camera; microphone; autoplay; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="live video"
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1.5rem",
            fontFamily: MONO,
            fontSize: "1rem",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          live — waiting for Halim to come online
        </div>
      )}

      {/* LIVE badge top-left */}
      {videoUrl && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontFamily: MONO,
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#fff",
            background: "rgba(0,0,0,0.45)",
            padding: "0.25rem 0.5rem",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          live
        </div>
      )}

      {/* Timer overlay top-right */}
      <TimerOverlay
        phase={phase}
        windowSeconds={windowSeconds}
        writingStartsAt={writingStartsAt}
        color={color}
      />

      {/* Theme overlay, subtle, bottom-left */}
      {theme && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            maxWidth: "80%",
            background: "rgba(0,0,0,0.5)",
            padding: "0.35rem 0.6rem",
            fontFamily: MONO,
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "0.02em",
          }}
        >
          <span style={{ color, opacity: 0.9 }}>writing on:</span> {theme}
        </div>
      )}
    </div>
  );
}

function TimerOverlay({
  phase,
  windowSeconds,
  writingStartsAt,
  color,
}: {
  phase: string;
  windowSeconds: number;
  writingStartsAt: string | null;
  color: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = phase === "writing" && !!writingStartsAt;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  // During writing: count down from writing_starts_at + window_seconds (server
  // timestamp => synced across devices). Otherwise: static window length, so
  // the room sees e.g. 30:00 before the clock starts.
  let remaining = windowSeconds;
  if (running && writingStartsAt) {
    const elapsed = (now - new Date(writingStartsAt).getTime()) / 1000;
    remaining = windowSeconds - elapsed;
  }
  const done = running && remaining <= 0;

  // Only show the timer once the show is underway (writing or later). In
  // pre-show the big countdown lives in the main column instead.
  if (phase === "pre-show") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "rgba(0,0,0,0.5)",
        padding: "0.3rem 0.6rem",
        textAlign: "right",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.6rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {done ? "time" : "window"}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: "2.4rem",
          lineHeight: 1,
          color: running ? color : "rgba(255,255,255,0.6)",
        }}
      >
        {done ? "00:00" : fmt(remaining)}
      </div>
    </div>
  );
}

/* ---------- Main-column states ---------- */

function PreShow({
  writingStartsAt,
  color,
}: {
  writingStartsAt: string | null;
  color: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!writingStartsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [writingStartsAt]);

  let countdown: string | null = null;
  let portoTime: string | null = null;
  if (writingStartsAt) {
    const target = new Date(writingStartsAt).getTime();
    const diff = Math.max(0, Math.floor((target - now) / 1000));
    const hh = String(Math.floor(diff / 3600)).padStart(2, "0");
    const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const ss = String(diff % 60).padStart(2, "0");
    countdown = `${hh}:${mm}:${ss}`;
    portoTime = new Date(target).toLocaleTimeString("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      style={{
        flex: 1,
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "3rem",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "1rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          marginBottom: "1rem",
        }}
      >
        pre-show
      </div>
      {countdown ? (
        <>
          <div style={{ fontFamily: DISPLAY, fontSize: "6rem", lineHeight: 1, color }}>
            {countdown}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "1rem",
              color: "rgba(255,255,255,0.6)",
              marginTop: "1rem",
            }}
          >
            Halim writes live at {portoTime} Porto time.
          </div>
        </>
      ) : (
        <div
          style={{
            fontFamily: "Standard, sans-serif",
            fontSize: "1.4rem",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 520,
          }}
        >
          The duel begins shortly. Scan the code to follow along and vote when
          the poems land.
        </div>
      )}
    </div>
  );
}

function WritingState({
  theme,
  color,
}: {
  theme: string | null;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "3rem",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "1rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color,
          marginBottom: "1.25rem",
        }}
      >
        poet writing
      </div>
      {theme && (
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: "3.5rem",
            lineHeight: 1,
            color: "#fff",
            marginBottom: "1.25rem",
          }}
        >
          {theme}
        </div>
      )}
      <div
        style={{
          fontFamily: "Standard, sans-serif",
          fontSize: "1.3rem",
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.55)",
          maxWidth: 520,
        }}
      >
        Both poems appear here, side by side, when the window closes.
      </div>
    </div>
  );
}

function PoemsPair({
  state,
  color,
  showHumanFirst,
  revealAuthorship,
}: {
  state: StageStateRow | null;
  color: string;
  showHumanFirst: boolean;
  revealAuthorship: boolean;
}) {
  if (!state || (!state.human_poem && !state.machine_poem)) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        waiting for poems…
      </div>
    );
  }

  const left = showHumanFirst
    ? { text: state.human_poem, label: "Poem A", actual: "Halim" as const }
    : { text: state.machine_poem, label: "Poem A", actual: "Machine" as const };
  const right = showHumanFirst
    ? { text: state.machine_poem, label: "Poem B", actual: "Machine" as const }
    : { text: state.human_poem, label: "Poem B", actual: "Halim" as const };

  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1.75rem",
        minHeight: 0,
      }}
    >
      {[left, right].map((p) => (
        <article
          key={p.label}
          style={{
            border: `1px solid ${color}`,
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.85rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: revealAuthorship ? color : "rgba(255,255,255,0.5)",
              marginBottom: "1.25rem",
            }}
          >
            {revealAuthorship ? p.actual : p.label}
          </div>
          <div
            style={{
              whiteSpace: "pre-line",
              fontFamily: "Standard, sans-serif",
              fontSize: "1.35rem",
              lineHeight: 1.6,
              color: "#fff",
              flex: 1,
            }}
          >
            {p.text || "—"}
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- QR ---------- */

function QRBlock({
  url,
  color,
  hasTheme,
}: {
  url: string;
  color: string;
  hasTheme: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (!url) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.8rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.6)",
        }}
      >
        {hasTheme ? "scan to vote on the poems" : "scan to follow along"}
      </div>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "stretch" }}>
        <div style={{ background: "#fff", padding: "0.6rem", border: `1px solid ${color}` }}>
          <QRCodeSVG value={url} size={140} bgColor="#fff" fgColor="#000" />
        </div>
        <button
          aria-label="Show instructions"
          onClick={() => setHelpOpen((h) => !h)}
          style={{
            width: 48,
            border: `1px solid ${color}`,
            background: helpOpen ? color : "transparent",
            color: helpOpen ? "#000" : "#fff",
            fontFamily: MONO,
            fontSize: "1.3rem",
            cursor: "pointer",
          }}
        >
          ?
        </button>
      </div>
      {helpOpen && (
        <div
          style={{
            maxWidth: 300,
            border: `1px solid ${color}`,
            padding: "0.85rem",
            fontFamily: MONO,
            fontSize: "0.82rem",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.85)",
            background: "#000",
          }}
        >
          1. Scan the QR with your phone.
          <br />
          2. Read both poems and vote for the one you prefer.
          <br />
          3. Then suggest the next theme.
          <br />
          4. Your vote trains the next model.
        </div>
      )}
    </div>
  );
}
