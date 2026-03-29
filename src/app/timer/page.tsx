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

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          // Fire notification
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

  const bg = isDark ? "#000" : "#fff";
  const fg = isDark ? "#fff" : "#000";
  const hasStarted = timeLeft < 1800 || isRunning;

  return (
    <div
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
        fontFamily: '"Courier New", Courier, monospace',
      }}
    >
      {/* Theme toggle - top right */}
      <button
        onClick={() => setIsDark(!isDark)}
        aria-label="Toggle theme"
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${fg}`,
          background: "transparent",
          color: fg,
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.5,
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
        }}
      >
        {isDark ? "\u23FE" : "\u2600\uFE0E"}
      </button>

      {/* Break toggle - top left */}
      <button
        onClick={() => setIsBreak(!isBreak)}
        aria-label="Toggle break mode"
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${fg}`,
          background: isBreak ? fg : "transparent",
          color: isBreak ? bg : fg,
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isBreak ? 1 : 0.5,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          if (!isBreak) e.currentTarget.style.opacity = "0.5";
        }}
      >
        ✷
      </button>

      {/* Timer display */}
      <div
        style={{
          display: "flex",
          flexDirection: isBreak || isFinished ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginBottom: 60,
          lineHeight: isBreak || isFinished ? 0.9 : 1,
          marginTop: -100,
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
                fontFamily: '"Georgia", "Garamond", serif',
                fontWeight: 400,
                color: fg,
                margin: "0 20px",
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
            fontSize: 32,
            letterSpacing: 1,
            opacity: 0.7,
            marginBottom: 20,
            marginTop: -40,
          }}
        >
          POET GENERATING
          <span className="loading-dots" />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 20 }}>
        <button
          onClick={isRunning ? pauseTimer : startTimer}
          disabled={isFinished && !hasStarted}
          style={buttonStyle(fg)}
        >
          {isRunning ? "PAUSE" : hasStarted && !isFinished ? "RESUME" : "START"}
        </button>
        {hasStarted && (
          <button onClick={resetTimer} style={buttonStyle(fg)}>
            RESET
          </button>
        )}
      </div>

      {/* Edit box - bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          textAlign: "left",
        }}
      >
        <div style={editRowStyle}>
          <label style={editLabelStyle(fg)}>THEME:</label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="enter theme..."
            style={editInputStyle(fg, bg)}
          />
        </div>
        <div style={editRowStyle}>
          <label style={editLabelStyle(fg)}>MODEL:</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model name..."
            style={editInputStyle(fg, bg)}
          />
        </div>
      </div>

      {/* Back link - top center */}
      <a
        href="/"
        style={{
          position: "absolute",
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.8rem",
          color: fg,
          opacity: 0.4,
          transition: "opacity 0.2s ease",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.4";
        }}
      >
        Singulars
      </a>

      {/* Loading dots animation + responsive styles */}
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
          font-size: 300px;
        }
        .timer-colon {
          font-size: 300px;
        }
        @media (max-width: 768px) {
          .timer-digit { font-size: 150px !important; }
          .timer-colon { font-size: 150px !important; }
        }
        @media (max-width: 480px) {
          .timer-digit { font-size: 100px !important; }
          .timer-colon { font-size: 100px !important; }
        }
      `}</style>
    </div>
  );
}

function timerDigitStyle(fg: string, isMessage: boolean): React.CSSProperties {
  return {
    fontFamily: '"Georgia", "Garamond", serif',
    fontWeight: 400,
    fontVariantNumeric: "tabular-nums",
    color: fg,
    textAlign: "center",
    display: "inline-block",
    width: isMessage ? "auto" : "2.2ch",
  };
}

function buttonStyle(fg: string): React.CSSProperties {
  return {
    backgroundColor: "transparent",
    color: fg,
    border: `1px solid ${fg}`,
    padding: "12px 40px",
    fontSize: 18,
    fontFamily: '"Courier New", Courier, monospace',
    cursor: "pointer",
    transition: "all 0.2s ease",
  };
}

const editRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 12,
  gap: 12,
};

function editLabelStyle(fg: string): React.CSSProperties {
  return {
    fontSize: 16,
    letterSpacing: 1,
    width: 80,
    opacity: 0.7,
    color: fg,
  };
}

function editInputStyle(fg: string, bg: string): React.CSSProperties {
  return {
    backgroundColor: fg,
    color: bg,
    border: `1px solid ${fg}`,
    padding: "8px 12px",
    fontSize: 16,
    fontFamily: '"Courier New", Courier, monospace',
    width: 400,
    transition: "all 0.3s ease",
  };
}
