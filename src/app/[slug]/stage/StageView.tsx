"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { iceServers, waitForIceGathering } from "@/lib/webrtc";

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
  camera_on: boolean;
  webrtc_offer: string | null;
  webrtc_answer: string | null;
  sandbox: boolean;
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
      /* ignore */
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

  const showHumanFirst = useMemo(() => {
    const seed = performance.id
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return seed % 2 === 0;
  }, [performance.id]);

  // QR always points to the performance page (the room reads the poems there,
  // with the about section collapsed, and votes inline).
  const qrUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/${performance.slug}`;
  }, [performance.slug]);

  const hasPoems = !!(state && (state.human_poem || state.machine_poem));

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
        gap: "1.75rem",
        fontFamily: '"Standard", sans-serif',
      }}
      data-phase={phase}
    >
      {/* Header: title + battling line + STATUS */}
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
              fontSize: "4rem",
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
              fontSize: "0.95rem",
              color: "rgba(255,255,255,0.7)",
              margin: "0.7rem 0 0 0",
            }}
          >
            Halim is writing against <span style={{ color }}>{OPPONENT}</span> —
            a machine trained on his own poems.
          </p>
        </div>
        <StatusBadge phase={phase} theme={state?.theme ?? null} color={color} />
      </header>

      {/* Body: poems on the left, camera + QR on the right */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1.55fr 1fr",
          gap: "2rem",
        }}
      >
        {/* MAIN — the last poem pair (always, if present) */}
        <section style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          {hasPoems ? (
            <PoemsPair state={state} color={color} showHumanFirst={showHumanFirst} />
          ) : (
            <EmptyMain phase={phase} color={color} />
          )}
        </section>

        {/* RIGHT — camera (top) then QR + instructions (same width as camera) */}
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            minHeight: 0,
          }}
        >
          <CameraTile
            slug={performance.slug}
            cameraOn={!!state?.camera_on}
            offer={state?.webrtc_offer ?? null}
            videoUrl={state?.video_embed_url ?? null}
            phase={phase}
            theme={state?.theme ?? null}
            windowSeconds={state?.window_seconds ?? 1800}
            writingStartsAt={state?.writing_starts_at ?? null}
            color={color}
            staticMode={staticMode}
          />
          <QRBlock url={qrUrl} color={color} hasTheme={!!state?.theme_slug} />
        </aside>
      </div>

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

      {/* Sandbox marker — votes/poems are NOT being recorded. */}
      {state?.sandbox && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            fontFamily: MONO,
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#000",
            background: "#f59e0b",
            padding: "0.2rem 0.5rem",
          }}
        >
          sandbox · not recording
        </div>
      )}
    </main>
  );
}

/* ---------- status ---------- */

function StatusBadge({
  phase,
  theme,
  color,
}: {
  phase: string;
  theme: string | null;
  color: string;
}) {
  const writing = phase === "writing";
  const label =
    phase === "pre-show"
      ? "pre-show"
      : writing
        ? theme
          ? `writing on ${theme}`
          : "writing"
        : "not writing — on break";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        border: `1px solid ${writing ? color : "rgba(255,255,255,0.25)"}`,
        padding: "0.6rem 1rem",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: writing ? color : "rgba(255,255,255,0.4)",
          boxShadow: writing ? `0 0 8px ${color}` : "none",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: MONO,
          fontSize: "1rem",
          color: writing ? "#fff" : "rgba(255,255,255,0.7)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ---------- camera (WebRTC viewer) ---------- */

function CameraTile({
  slug,
  cameraOn,
  offer,
  videoUrl,
  phase,
  theme,
  windowSeconds,
  writingStartsAt,
  color,
  staticMode,
}: {
  slug: string;
  cameraOn: boolean;
  offer: string | null;
  videoUrl: string | null;
  phase: string;
  theme: string | null;
  windowSeconds: number;
  writingStartsAt: string | null;
  color: string;
  staticMode: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const lastOfferRef = useRef<string | null>(null);
  const [streamLive, setStreamLive] = useState(false);

  // WebRTC viewer: when control publishes an offer (camera on), answer it.
  useEffect(() => {
    if (staticMode) return;
    if (!cameraOn || !offer) {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      lastOfferRef.current = null;
      setStreamLive(false);
      return;
    }
    if (offer === lastOfferRef.current) return; // already handled
    lastOfferRef.current = offer;
    let cancelled = false;

    (async () => {
      try {
        if (pcRef.current) pcRef.current.close();
        const pc = new RTCPeerConnection({ iceServers: iceServers() });
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (videoRef.current && e.streams[0]) {
            videoRef.current.srcObject = e.streams[0];
            setStreamLive(true);
          }
        };
        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          if (s === "failed" || s === "disconnected" || s === "closed") {
            setStreamLive(false);
          }
        };
        await pc.setRemoteDescription(JSON.parse(offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        await waitForIceGathering(pc);
        if (cancelled) return;
        await fetch(`/api/stage/${slug}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webrtc_answer: JSON.stringify(pc.localDescription),
          }),
        });
      } catch {
        /* leave placeholder up */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraOn, offer, slug, staticMode]);

  const showVideo = cameraOn && streamLive;
  const showIframe = !showVideo && !!videoUrl; // fallback (Daily/Whereby/etc.)

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
      {/* live camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: showVideo ? "block" : "none",
          transform: "scaleX(-1)", // mirror so it reads natural
        }}
      />

      {/* fallback iframe */}
      {showIframe && (
        <iframe
          src={videoUrl!}
          allow="camera; microphone; autoplay; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="live video"
        />
      )}

      {/* placeholder */}
      {!showVideo && !showIframe && (
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
          {phase === "break"
            ? "Halim is on break"
            : cameraOn
              ? "connecting to Halim's camera…"
              : "camera off — waiting for Halim"}
        </div>
      )}

      {/* LIVE badge */}
      {showVideo && (
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
            }}
          />
          live · San Francisco
        </div>
      )}

      {/* timer overlay */}
      <TimerOverlay
        phase={phase}
        windowSeconds={windowSeconds}
        writingStartsAt={writingStartsAt}
        color={color}
      />

      {/* theme overlay */}
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
          }}
        >
          <span style={{ color }}>
            {phase === "writing" ? "writing on:" : "theme:"}
          </span>{" "}
          {theme}
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

  if (phase === "pre-show") return null;
  let remaining = windowSeconds;
  if (running && writingStartsAt) {
    remaining = windowSeconds - (now - new Date(writingStartsAt).getTime()) / 1000;
  }
  const done = running && remaining <= 0;

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
          fontSize: "2.2rem",
          lineHeight: 1,
          color: running ? color : "rgba(255,255,255,0.6)",
        }}
      >
        {done ? "00:00" : fmt(remaining)}
      </div>
    </div>
  );
}

/* ---------- main column ---------- */

function EmptyMain({ phase, color }: { phase: string; color: string }) {
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
          color: phase === "writing" ? color : "rgba(255,255,255,0.5)",
          marginBottom: "1rem",
        }}
      >
        {phase === "writing" ? "poet writing" : phase === "break" ? "on break" : "pre-show"}
      </div>
      <div
        style={{
          fontFamily: "Standard, sans-serif",
          fontSize: "1.3rem",
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.55)",
          maxWidth: 520,
        }}
      >
        {phase === "writing"
          ? "Both poems appear here, side by side, when the window closes."
          : "The duel begins shortly. Scan the code to follow along and vote when the poems land."}
      </div>
    </div>
  );
}

function PoemsPair({
  state,
  color,
  showHumanFirst,
}: {
  state: StageStateRow | null;
  color: string;
  showHumanFirst: boolean;
}) {
  if (!state) return null;
  const left = showHumanFirst
    ? { text: state.human_poem, label: "Poem A" }
    : { text: state.machine_poem, label: "Poem A" };
  const right = showHumanFirst
    ? { text: state.machine_poem, label: "Poem B" }
    : { text: state.human_poem, label: "Poem B" };

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
              color: "rgba(255,255,255,0.5)",
              marginBottom: "1.25rem",
            }}
          >
            {p.label}
          </div>
          <div
            style={{
              whiteSpace: "pre-line",
              fontFamily: "Standard, sans-serif",
              fontSize: "1.3rem",
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

/* ---------- QR + instructions (matched width, no toggle) ---------- */

function QRBlock({
  url,
  color,
  hasTheme,
}: {
  url: string;
  color: string;
  hasTheme: boolean;
}) {
  if (!url) return null;
  const steps = [
    "Scan the code with your phone.",
    "Read both poems, tap the one you like.",
    "Then suggest the next theme.",
  ];
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "stretch", width: "100%" }}>
      <div
        style={{
          background: "#fff",
          padding: "0.6rem",
          border: `1px solid ${color}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <QRCodeSVG value={url} size={132} bgColor="#fff" fgColor="#000" />
      </div>
      <div
        style={{
          flex: 1,
          border: `1px solid ${color}`,
          padding: "0.9rem 1.1rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "0.55rem",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color,
          }}
        >
          {hasTheme ? "scan to read & vote" : "scan to follow along"}
        </div>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ color, marginRight: "0.5rem" }}>{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
