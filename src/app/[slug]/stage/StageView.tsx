"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useCountdown, formatMMSS } from "@/lib/useCountdown";

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

export default function StageView({
  performance,
  initialState,
  staticMode,
}: Props) {
  // Hydrate from localStorage cache immediately so reload-during-outage
  // still paints something. SSR initial state wins over cache if present.
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

  // Persist to localStorage on every state update.
  useEffect(() => {
    if (typeof window === "undefined" || !state) return;
    try {
      localStorage.setItem(CACHE_KEY(performance.slug), JSON.stringify(state));
    } catch {
      // quota / disabled storage — ignore
    }
  }, [state, performance.slug]);

  // Polling loop — only when visible, exponential backoff on failures.
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

  // Stable anonymized order: seed by perf id so reloads don't flip A/B.
  const showHumanFirst = useMemo(() => {
    const seed = performance.id
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return seed % 2 === 0;
  }, [performance.id]);

  const qrUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (state?.theme_slug) return `${origin}/${performance.slug}/${state.theme_slug}`;
    return `${origin}/theme-voting`;
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
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto 1fr auto",
        gridTemplateAreas: `
          "header  header"
          "video   content"
          "footerL footerR"
        `,
        gap: "2rem",
        fontFamily: '"Standard", sans-serif',
      }}
      data-phase={phase}
    >
      {/* Header band: title + theme + countdown */}
      <header
        style={{
          gridArea: "header",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: '"Terminal Grotesque", sans-serif',
              fontSize: "5rem",
              lineHeight: 0.9,
              fontWeight: 400,
              margin: 0,
              color: performance.color,
            }}
          >
            {performance.name}
          </h1>
          {state?.theme && (
            <p
              style={{
                fontFamily: '"Diatype Mono Variable", monospace',
                fontSize: "1.4rem",
                color: "rgba(255,255,255,0.85)",
                margin: "0.75rem 0 0 0",
                textTransform: "lowercase",
                letterSpacing: "0.03em",
              }}
            >
              theme: {state.theme}
            </p>
          )}
        </div>

        <PreShowCountdown
          phase={phase}
          writingStartsAt={state?.writing_starts_at ?? null}
          color={performance.color}
        />
      </header>

      {/* Video tile: left side, large */}
      <section
        style={{
          gridArea: "video",
          background: "#0a0a0a",
          border: `1px solid ${performance.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          minHeight: 0,
          aspectRatio: "16 / 10",
        }}
      >
        {state?.video_embed_url ? (
          <iframe
            src={state.video_embed_url}
            allow="camera; microphone; autoplay; fullscreen"
            allowFullScreen
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            title="live video"
          />
        ) : (
          <div
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              padding: "2rem",
            }}
          >
            LIVE — waiting for Halim to come online
          </div>
        )}
      </section>

      {/* Content region: poems or a "writing" placeholder */}
      <section
        style={{
          gridArea: "content",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {phase === "pre-show" || phase === "writing" ? (
          <WritingPlaceholder phase={phase} color={performance.color} />
        ) : (
          <PoemsPair
            state={state}
            color={performance.color}
            showHumanFirst={showHumanFirst}
            revealAuthorship={phase === "result"}
          />
        )}
      </section>

      {/* Footer left: timer */}
      <footer
        style={{
          gridArea: "footerL",
          display: "flex",
          alignItems: "flex-end",
          gap: "1.5rem",
        }}
      >
        <TimerDisplay
          windowSeconds={state?.window_seconds ?? 1200}
          phase={phase}
          writingStartsAt={state?.writing_starts_at ?? null}
          color={performance.color}
        />
      </footer>

      {/* Footer right: QR + ? help */}
      <footer
        style={{
          gridArea: "footerR",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          gap: "1rem",
        }}
      >
        <QRBlock url={qrUrl} color={performance.color} phase={phase} />
      </footer>

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
            background: pollHealth === "ok" ? performance.color : "#f59e0b",
            opacity: 0.65,
          }}
        />
      )}
    </main>
  );
}

function PreShowCountdown({
  phase,
  writingStartsAt,
  color,
}: {
  phase: string;
  writingStartsAt: string | null;
  color: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== "pre-show" || !writingStartsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, writingStartsAt]);

  if (phase !== "pre-show" || !writingStartsAt) return null;

  const target = new Date(writingStartsAt).getTime();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const hh = String(Math.floor(diff / 3600)).padStart(2, "0");
  const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const ss = String(diff % 60).padStart(2, "0");
  const portoTime = new Date(target).toLocaleTimeString("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.9rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        Halim writes live at {portoTime} Porto
      </div>
      <div
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "3.5rem",
          lineHeight: 1,
          color,
          marginTop: "0.4rem",
        }}
      >
        {hh}:{mm}:{ss}
      </div>
    </div>
  );
}

function WritingPlaceholder({ phase, color }: { phase: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        fontFamily: '"Diatype Mono Variable", monospace',
      }}
    >
      <div>
        <div
          style={{
            color: phase === "writing" ? color : "rgba(255,255,255,0.5)",
            fontSize: "1.2rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          {phase === "writing" ? "POET WRITING" : "PRE-SHOW"}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "0.95rem",
            lineHeight: 1.5,
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          {phase === "writing"
            ? "Both poems will appear here when the window closes."
            : "The room scans the QR to suggest a theme. Voting opens once the poems land."}
        </div>
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
          fontFamily: '"Diatype Mono Variable", monospace',
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
          padding: "3rem",
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
        gap: "2rem",
        minHeight: 0,
      }}
    >
      {[left, right].map((p) => (
        <article
          key={p.label}
          style={{
            border: `1px solid ${color}`,
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <div
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.8rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: revealAuthorship ? color : "rgba(255,255,255,0.5)",
              marginBottom: "1rem",
            }}
          >
            {revealAuthorship ? p.actual : p.label}
          </div>
          <div
            style={{
              whiteSpace: "pre-line",
              fontFamily: '"Standard", sans-serif',
              fontSize: "1.05rem",
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.92)",
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

function TimerDisplay({
  windowSeconds,
  phase,
  writingStartsAt,
  color,
}: {
  windowSeconds: number;
  phase: string;
  writingStartsAt: string | null;
  color: string;
}) {
  const { timeLeft, isRunning, start, pause, reset } = useCountdown(
    windowSeconds,
    false,
  );

  // Wire timer state to phase: start on entering 'writing', pause otherwise.
  useEffect(() => {
    if (phase === "writing") {
      reset(windowSeconds);
      start();
    } else {
      pause();
      reset(windowSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, windowSeconds, writingStartsAt]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Window
      </div>
      <div
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "5rem",
          lineHeight: 1,
          color: isRunning ? color : "rgba(255,255,255,0.5)",
        }}
      >
        {formatMMSS(timeLeft)}
      </div>
    </div>
  );
}

function QRBlock({
  url,
  color,
  phase,
}: {
  url: string;
  color: string;
  phase: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (!url) return null;
  const isVotingPhase = phase === "vote" || phase === "poems";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}
    >
      <div
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {isVotingPhase ? "Scan to vote" : "Scan to suggest a theme"}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
        <div
          style={{
            background: "#fff",
            padding: "0.5rem",
            border: `1px solid ${color}`,
          }}
        >
          <QRCodeSVG value={url} size={120} bgColor="#fff" fgColor="#000" />
        </div>
        <button
          aria-label="Show instructions"
          onClick={() => setHelpOpen((h) => !h)}
          style={{
            width: 44,
            border: `1px solid ${color}`,
            background: helpOpen ? color : "transparent",
            color: helpOpen ? "#000" : "#fff",
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "1.2rem",
            cursor: "pointer",
          }}
        >
          ?
        </button>
      </div>
      {helpOpen && (
        <div
          style={{
            maxWidth: 280,
            border: `1px solid ${color}`,
            padding: "0.75rem",
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.8rem",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.85)",
            background: "#000",
            textAlign: "left",
          }}
        >
          1. Scan the QR with your phone.<br />
          2. Suggest a theme and vote on others.<br />
          3. When the poems land, vote on the pair.<br />
          4. Your vote trains the next model.
        </div>
      )}
    </div>
  );
}
