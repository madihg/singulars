"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { iceServers, waitForIceGathering } from "@/lib/webrtc";

type Phase = "pre-show" | "writing" | "break";
const PHASES: Phase[] = ["pre-show", "writing", "break"];

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
  const [machinePoem, setMachinePoem] = useState(initialState?.machine_poem ?? "");
  const [videoUrl, setVideoUrl] = useState(initialState?.video_embed_url ?? "");
  const [windowSeconds, setWindowSeconds] = useState(
    initialState?.window_seconds ?? 1800,
  );
  const [cameraOn, setCameraOn] = useState(initialState?.camera_on ?? false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        /* ignore */
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
        setState((s) =>
          s
            ? ({ ...s, ...patch, updated_at: new Date().toISOString() } as StageStateRow)
            : s,
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(null);
      }
    },
    [controlKey, performance.slug],
  );

  // Phase changes also drive the camera: writing turns it on, break/pre-show
  // turn it off. (Manual toggle still available below.)
  const setPhase = useCallback(
    (p: Phase) => {
      post({ phase: p }, `phase:${p}`);
      if (p === "writing") setCameraOn(true);
      else setCameraOn(false);
    },
    [post],
  );

  // Start the writing window NOW: stamp writing_starts_at=now, flip to
  // 'writing', and turn the camera on. The stage syncs off this timestamp.
  const startWritingNow = useCallback(() => {
    post(
      { phase: "writing", writing_starts_at: new Date().toISOString() },
      "start-writing",
    );
    setCameraOn(true);
  }, [post]);

  // PUBLISH the current theme + both poems to the stage: snapshots them into
  // published_* (what the stage shows). When live (not test mode), the API
  // also commits them to singulars.poems → they appear on the performance
  // page and become votable. Locking a NEW theme afterwards only changes the
  // camera; the published pair stays until you publish the next one.
  const publishPoems = useCallback(() => {
    post(
      {
        published_theme: theme,
        published_theme_slug: slugify(theme),
        published_human_poem: humanPoem,
        published_machine_poem: machinePoem,
      },
      "publish",
    );
  }, [post, theme, humanPoem, machinePoem]);

  // Keyboard: 1-3 phases, Cmd/Ctrl+Enter saves a textarea, Cmd/Ctrl+L video.
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
      const idx = ["1", "2", "3"].indexOf(e.key);
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

      {/* Sandbox / production mode */}
      <section
        style={{
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          border: `1px solid ${state?.sandbox ? "#d97706" : accent}`,
          background: state?.sandbox ? "#fff7ed" : "transparent",
          padding: "0.75rem 1rem",
        }}
      >
        <span
          style={{
            fontFamily: monoFont,
            fontSize: "0.8rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: state?.sandbox ? "#b45309" : accent,
            fontWeight: 600,
          }}
        >
          {state?.sandbox ? "● test mode — not recording" : "● live — recording"}
        </span>
        <button
          onClick={() => post({ sandbox: !state?.sandbox }, "sandbox")}
          disabled={saving === "sandbox"}
          style={{
            padding: "0.45rem 0.9rem",
            border: `1px solid ${state?.sandbox ? accent : "#d97706"}`,
            background: "transparent",
            color: state?.sandbox ? accent : "#b45309",
            fontFamily: monoFont,
            fontSize: "0.8rem",
            cursor: "pointer",
            letterSpacing: "0.03em",
            textTransform: "lowercase",
          }}
        >
          {saving === "sandbox"
            ? "switching…"
            : state?.sandbox
              ? "→ go live (record votes)"
              : "→ back to test mode"}
        </button>
        <span style={{ fontFamily: monoFont, fontSize: "0.72rem", color: "rgba(0,0,0,0.45)" }}>
          {state?.sandbox
            ? "test freely — poems show on stage but aren't saved and can't be voted on."
            : "poems commit to the database and the audience can vote. you're live."}
        </span>
      </section>

      {/* Phase pills */}
      <section style={{ marginBottom: "1.25rem" }}>
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
          phase ( press 1–3 )
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {PHASES.map((p, i) => {
            const active = state?.phase === p;
            const labelMap: Record<Phase, string> = {
              "pre-show": "pre-show",
              writing: "writing (camera on)",
              break: "break (camera off)",
            };
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
                {i + 1}. {labelMap[p]}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "0.85rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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
              : `▶ start writing — camera on + ${Math.round(windowSeconds / 60)}min timer`}
          </button>
        </div>
      </section>

      {/* Camera */}
      <section style={{ marginBottom: "1.75rem" }}>
        <CameraPublisher
          slug={performance.slug}
          controlKey={controlKey}
          on={cameraOn}
          onToggle={() => setCameraOn((v) => !v)}
          answer={state?.webrtc_answer ?? null}
          accent={accent}
        />
      </section>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Field label="theme (what you're writing on)">
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

          <Field
            label="video fallback url (optional)"
            hint="only used if the live camera can't connect — e.g. a Daily/Whereby room"
          >
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
                save fallback url
              </SaveBtn>
            </RowActions>
          </Field>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Field label="my poem (Cmd/Ctrl+Enter to save)">
            <textarea
              data-field="human_poem"
              value={humanPoem}
              onChange={(e) => setHumanPoem(e.target.value)}
              rows={7}
              style={textareaStyle}
            />
            <RowActions>
              <SaveBtn
                onClick={() => post({ human_poem: humanPoem }, "human_poem")}
                saving={saving === "human_poem"}
                accent={accent}
              >
                save my poem
              </SaveBtn>
            </RowActions>
          </Field>

          <Field label="machine poem (paste from /chat · frontière)">
            <textarea
              data-field="machine_poem"
              value={machinePoem}
              onChange={(e) => setMachinePoem(e.target.value)}
              rows={7}
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
          <p style={{ fontFamily: monoFont, fontSize: "0.75rem", color: "rgba(0,0,0,0.45)", margin: 0, lineHeight: 1.5 }}>
            saving keeps a draft; nothing shows on stage until you publish.
          </p>
        </div>
      </div>

      {/* PUBLISH — snapshots this theme + both poems onto the stage. When
          live (not test mode), also commits them to the site + opens voting. */}
      <section style={{ marginTop: "1.5rem" }}>
        <button
          onClick={publishPoems}
          disabled={saving === "publish" || !theme.trim() || !humanPoem.trim() || !machinePoem.trim()}
          style={{
            width: "100%",
            padding: "0.85rem 1.25rem",
            border: `1px solid ${accent}`,
            background:
              !theme.trim() || !humanPoem.trim() || !machinePoem.trim()
                ? "rgba(0,0,0,0.04)"
                : accent,
            color:
              !theme.trim() || !humanPoem.trim() || !machinePoem.trim()
                ? "rgba(0,0,0,0.4)"
                : "#fff",
            fontFamily: monoFont,
            fontSize: "0.95rem",
            cursor:
              saving === "publish"
                ? "wait"
                : !theme.trim() || !humanPoem.trim() || !machinePoem.trim()
                  ? "not-allowed"
                  : "pointer",
            letterSpacing: "0.03em",
            textTransform: "lowercase",
          }}
        >
          {saving === "publish"
            ? "publishing…"
            : `▶ publish poems to stage${state?.sandbox ? " (test — not committed)" : " + site + voting"}`}
        </button>
        <p style={{ fontFamily: monoFont, fontSize: "0.75rem", color: "rgba(0,0,0,0.45)", marginTop: "0.5rem", lineHeight: 1.5 }}>
          {state?.published_theme
            ? `on stage now: "${state.published_theme}". `
            : ""}
          publishes the pair above under theme &ldquo;{theme || "…"}&rdquo;. lock a
          new theme afterwards to start the next round — the camera switches, the
          published pair stays until you publish again.
        </p>
      </section>

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
          stage preview (static)
        </div>
        <iframe
          src={`/${performance.slug}/stage?static=1`}
          style={{ width: "100%", height: 480, border: `1px solid ${accent}`, background: "#000" }}
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
        shortcuts: 1–3 phase · Cmd/Ctrl+L video url · Cmd/Ctrl+Enter save textarea
        <br />
        last updated:{" "}
        {state?.updated_at ? new Date(state.updated_at).toLocaleTimeString() : "—"}
      </footer>
    </main>
  );
}

/* ---------- camera publisher (getUserMedia → WebRTC) ---------- */

function CameraPublisher({
  slug,
  controlKey,
  on,
  onToggle,
  answer,
  accent,
}: {
  slug: string;
  controlKey: string;
  on: boolean;
  onToggle: () => void;
  answer: string | null;
  accent: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const appliedAnswerRef = useRef<string | null>(null);
  const [status, setStatus] = useState<
    "off" | "starting" | "waiting" | "live" | "error"
  >("off");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // Bumped to force a fresh offer/publish when a handshake fails to traverse.
  const [retryNonce, setRetryNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postUpdate = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await fetch(
          `/api/stage/${slug}/update?key=${encodeURIComponent(controlKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
      } catch {
        /* ignore */
      }
    },
    [slug, controlKey],
  );

  const teardownLocal = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    appliedAnswerRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let activePc: RTCPeerConnection | null = null;
    if (!on) {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      teardownLocal();
      setStatus("off");
      postUpdate({ camera_on: false, webrtc_offer: null, webrtc_answer: null });
      return;
    }
    (async () => {
      try {
        setStatus("starting");
        setErrMsg(null);
        // Reuse the already-granted camera across retries so we don't re-prompt
        // or blink the local preview on every reconnect attempt.
        let stream = streamRef.current;
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
        }
        const activeStream = stream;
        if (videoRef.current) videoRef.current.srcObject = activeStream;

        // Fresh peer connection for this (re)publish — closing any prior one so
        // a retry doesn't leak/duplicate connections.
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
        const pc = new RTCPeerConnection({ iceServers: iceServers() });
        activePc = pc;
        pcRef.current = pc;
        activeStream.getTracks().forEach((t) => pc.addTrack(t, activeStream));
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === "connected") {
            setStatus("live");
          } else if (s === "failed") {
            // The handshake didn't traverse (likely the first attempt on a
            // restrictive venue network). Re-publish a fresh offer after a beat
            // so the venue re-answers — no manual camera toggle needed.
            setStatus("waiting");
            if (!retryTimerRef.current) {
              retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                setRetryNonce((n) => n + 1);
              }, 2500);
            }
          } else if (s === "disconnected") {
            setStatus("waiting");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);
        if (cancelled) return;
        appliedAnswerRef.current = null;
        await postUpdate({
          camera_on: true,
          webrtc_offer: JSON.stringify(pc.localDescription),
          webrtc_answer: null,
        });
        setStatus("waiting");
      } catch (e) {
        setStatus("error");
        setErrMsg(
          (e as Error)?.message?.includes("Permission") ||
            (e as Error)?.name === "NotAllowedError"
            ? "camera permission denied — allow it in the browser"
            : "couldn't start the camera",
        );
      }
    })();
    return () => {
      cancelled = true;
      // Detach the handler so a torn-down PC (closed by the next run) can't
      // fire a stale "failed" and schedule a duplicate retry.
      if (activePc) activePc.onconnectionstatechange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, retryNonce]);

  // Apply the stage's answer once it arrives.
  useEffect(() => {
    if (!on || !answer || !pcRef.current) return;
    if (answer === appliedAnswerRef.current) return;
    appliedAnswerRef.current = answer;
    (async () => {
      try {
        // Only apply to a PC that's actually awaiting an answer for its current
        // offer — guards against a stale answer landing on a freshly rebuilt PC.
        if (
          pcRef.current &&
          pcRef.current.signalingState === "have-local-offer" &&
          !pcRef.current.currentRemoteDescription
        ) {
          await pcRef.current.setRemoteDescription(JSON.parse(answer));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [answer, on]);

  const statusText =
    status === "live"
      ? "live — streaming to the venue"
      : status === "waiting"
        ? "camera on — connecting to the venue…"
        : status === "starting"
          ? "starting camera…"
          : status === "error"
            ? errMsg || "camera error"
            : "camera off";

  const mono = '"Diatype Mono Variable", monospace';

  return (
    <div>
      <div
        style={{
          fontFamily: mono,
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.6)",
          marginBottom: "0.5rem",
        }}
      >
        your camera (films you → shows on the venue screen)
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 240,
            aspectRatio: "16 / 10",
            background: "#000",
            border: `1px solid ${on ? accent : "rgba(0,0,0,0.2)"}`,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: on ? "block" : "none",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <button
            onClick={onToggle}
            style={{
              padding: "0.6rem 1.1rem",
              border: `1px solid ${accent}`,
              background: on ? "transparent" : accent,
              color: on ? accent : "#fff",
              fontFamily: mono,
              fontSize: "0.9rem",
              cursor: "pointer",
              letterSpacing: "0.03em",
              textTransform: "lowercase",
            }}
          >
            {on ? "turn camera off" : "turn camera on"}
          </button>
          <div
            style={{
              fontFamily: mono,
              fontSize: "0.8rem",
              color:
                status === "live"
                  ? accent
                  : status === "error"
                    ? "#dc2626"
                    : "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  status === "live"
                    ? accent
                    : status === "error"
                      ? "#dc2626"
                      : "rgba(0,0,0,0.3)",
              }}
            />
            {statusText}
          </div>
          <p style={{ fontFamily: mono, fontSize: "0.72rem", color: "rgba(0,0,0,0.4)", margin: 0, maxWidth: 260, lineHeight: 1.5 }}>
            turns on automatically when you start writing. audio goes through
            Teams, not here.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- field primitives ---------- */

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
        <div style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.45)", marginBottom: "0.4rem" }}>
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
