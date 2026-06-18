"use client";

import { useState } from "react";

/**
 * Small key-entry form shown on the control page's unauthorized state, so the
 * operator can type the control key directly instead of hand-editing the URL.
 * On submit it reloads the same path with ?key=<value> appended.
 */
export default function KeyPrompt({ accent = "#FF4D2E" }: { accent?: string }) {
  const [value, setValue] = useState("");

  function go() {
    const k = value.trim();
    if (!k) return;
    const base = window.location.pathname;
    window.location.href = `${base}?key=${encodeURIComponent(k)}`;
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <label
        htmlFor="control-key"
        style={{
          display: "block",
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.6)",
          marginBottom: "0.5rem",
        }}
      >
        control key
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          id="control-key"
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="enter control key"
          style={{
            flex: 1,
            padding: "0.6rem 0.8rem",
            border: "1px solid rgba(0,0,0,0.2)",
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={go}
          style={{
            padding: "0.6rem 1.1rem",
            border: `1px solid ${accent}`,
            background: accent,
            color: "#fff",
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.85rem",
            cursor: "pointer",
            letterSpacing: "0.03em",
            textTransform: "lowercase",
          }}
        >
          enter
        </button>
      </div>
      <p
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.75rem",
          color: "rgba(0,0,0,0.4)",
          marginTop: "0.6rem",
          lineHeight: 1.5,
        }}
      >
        your admin password, or the STAGE_CONTROL_KEY value.
      </p>
    </div>
  );
}
