"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function TimerPage() {
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isBreak, setIsBreak] = useState(false);
  const [theme, setTheme] = useState("");
  const [model, setModel] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isFinished = timeLeft === 0 && !isRunning;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (isRunning || timeLeft === 0) return;
    setIsRunning(true);

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Timer Complete!", {
              body: "30 minutes have elapsed.",
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRunning, timeLeft, clearTimer]);

  const pauseTimer = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeLeft(1800);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const bg = isDark ? "#000" : "var(--background)";
  const fg = isDark ? "#fff" : "var(--text-primary)";
  const fgMuted = isDark ? "rgba(255,255,255,0.5)" : "var(--text-hint)";
  const fgSecondary = isDark
    ? "rgba(255,255,255,0.7)"
    : "var(--text-secondary)";
  const borderColor = isDark ? "rgba(255,255,255,0.2)" : "var(--border-light)";
  const hasStarted = timeLeft < 1800 || isRunning;

  return (
    <div
      className="timer-page"
      style={{
        minHeight: "100vh",
        backgroundColor: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        transition: "background-color 0.3s ease, color 0.3s ease",
        position: "relative",
      }}
    >
      {/* Theme toggle - top right */}
      <button
        onClick={() => setIsDark(!isDark)}
        aria-label="Toggle theme"
        className="timer-corner-btn"
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${borderColor}`,
          background: "transparent",
          color: fgMuted,
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          fontFamily: '"Diatype Mono Variable", monospace',
        }}
      >
        {isDark ? "\u23FE" : "\u2600\uFE0E"}
      </button>

      {/* Break toggle - top left */}
      <button
        onClick={() => setIsBreak(!isBreak)}
        aria-label="Toggle break mode"
        className="timer-corner-btn"
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${isBreak ? fg : borderColor}`,
          background: isBreak ? fg : "transparent",
          color: isBreak ? bg : fgMuted,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          fontFamily: '"Diatype Mono Variable", monospace',
        }}
      >
        ✷
      </button>

      {/* Back link - top center */}
      <a
        href="/"
        className="timer-back-link"
        style={{
          position: "absolute",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.8rem",
          color: fgMuted,
          transition: "color 0.2s ease",
          textDecoration: "none",
          letterSpacing: "0.03em",
        }}
      >
        Singulars
      </a>

      {/* Timer display */}
      <div
        style={{
          display: "flex",
          flexDirection: isBreak || isFinished ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginBottom: 60,
          lineHeight: isBreak || isFinished ? 0.85 : 0.9,
          marginTop: -80,
        }}
      >
        {isBreak ? (
          <>
            <span className="timer-digit" style={timerDigitStyle(fg, true)}>
              POETS TAKE /
            </span>
            <span className="timer-digit" style={timerDigitStyle(fg, true)}>
              BREAKS
            </span>
          </>
        ) : isFinished ? (
          <>
            <span className="timer-digit" style={timerDigitStyle(fg, true)}>
              TIME&apos;S
            </span>
            <span className="timer-digit" style={timerDigitStyle(fg, true)}>
              UP!
            </span>
          </>
        ) : (
          <>
            <span className="timer-digit" style={timerDigitStyle(fg, false)}>
              {String(mins).padStart(2, "0")}
            </span>
            <span
              className="timer-colon"
              style={{
                fontFamily: '"Terminal Grotesque", sans-serif',
                fontWeight: 400,
                color: fgMuted,
                margin: "0 0.15em",
              }}
            >
              :
            </span>
            <span className="timer-digit" style={timerDigitStyle(fg, false)}>
              {String(secs).padStart(2, "0")}
            </span>
          </>
        )}
      </div>

      {/* Poet generating text */}
      {isRunning && !isBreak && (
        <div
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "1.1rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: fgSecondary,
            marginBottom: 24,
            marginTop: -32,
          }}
        >
          Poet generating
          <span className="loading-dots" />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={isRunning ? pauseTimer : startTimer}
          disabled={isFinished && !hasStarted}
          className="timer-btn"
          style={{
            backgroundColor: "transparent",
            color: fg,
            border: `1px solid ${borderColor}`,
            padding: "0.7rem 2.5rem",
            fontSize: "0.85rem",
            fontFamily: '"Diatype Mono Variable", monospace',
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 0.2s ease",
            borderRadius: "6px",
          }}
        >
          {isRunning ? "Pause" : hasStarted && !isFinished ? "Resume" : "Start"}
        </button>
        {hasStarted && (
          <button
            onClick={resetTimer}
            className="timer-btn"
            style={{
              backgroundColor: "transparent",
              color: fgSecondary,
              border: `1px solid ${borderColor}`,
              padding: "0.7rem 2.5rem",
              fontSize: "0.85rem",
              fontFamily: '"Diatype Mono Variable", monospace',
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.2s ease",
              borderRadius: "6px",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Edit box - bottom left */}
      <div
        className="timer-edit-box"
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          textAlign: "left",
        }}
      >
        <div style={editRowStyle}>
          <label
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              width: 70,
              color: fgMuted,
            }}
          >
            Theme
          </label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="enter theme..."
            style={{
              backgroundColor: "transparent",
              color: fg,
              border: `1px solid ${borderColor}`,
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              fontSize: "0.85rem",
              fontFamily: '"Diatype Mono Variable", monospace',
              width: 360,
              transition: "border-color 0.2s ease",
              outline: "none",
            }}
          />
        </div>
        <div style={editRowStyle}>
          <label
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              width: 70,
              color: fgMuted,
            }}
          >
            Model
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model name..."
            style={{
              backgroundColor: "transparent",
              color: fg,
              border: `1px solid ${borderColor}`,
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              fontSize: "0.85rem",
              fontFamily: '"Diatype Mono Variable", monospace',
              width: 360,
              transition: "border-color 0.2s ease",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .loading-dots::after {
          content: '';
          animation: loadingDots 1.5s steps(4, end) infinite;
        }
        @keyframes loadingDots {
          0% { content: ''; }
          25% { content: '.'; }
          50% { content: '..'; }
          75% { content: '...'; }
          100% { content: ''; }
        }
        .timer-digit {
          font-size: 20rem;
        }
        .timer-colon {
          font-size: 20rem;
        }
        .timer-corner-btn:hover {
          border-color: currentColor !important;
        }
        .timer-back-link:hover {
          color: ${fg} !important;
        }
        .timer-btn:hover:not(:disabled) {
          border-color: ${fg} !important;
        }
        .timer-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        @media (max-width: 768px) {
          .timer-digit { font-size: 10rem !important; }
          .timer-colon { font-size: 10rem !important; }
          .timer-edit-box { left: 20px !important; bottom: 20px !important; }
          .timer-edit-box input { width: 240px !important; }
          .timer-corner-btn { top: 20px !important; }
          .timer-back-link { top: 24px !important; }
        }
        @media (max-width: 480px) {
          .timer-digit { font-size: 6rem !important; }
          .timer-colon { font-size: 6rem !important; }
          .timer-edit-box input { width: 180px !important; }
        }
      `}</style>
    </div>
  );
}

function timerDigitStyle(fg: string, isMessage: boolean): React.CSSProperties {
  return {
    fontFamily: '"Terminal Grotesque", sans-serif',
    fontWeight: 400,
    color: fg,
    textAlign: "center",
    display: "inline-block",
    width: isMessage ? "auto" : "2.2ch",
  };
}

const editRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 10,
  gap: 10,
};
