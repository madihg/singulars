"use client";

/**
 * Copy-raw-text button for the system-prompts page. Mono accent.
 */

import { useState } from "react";
import { FONT_MONO } from "@/lib/admin-styles";

export function CopyButton({
  text,
  accentColor = "#171717",
}: {
  text: string;
  accentColor?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors silently; the prompt is visible on the page
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontFamily: FONT_MONO,
        fontSize: "0.75rem",
        padding: "0.3rem 0.7rem",
        border: `1px solid ${accentColor}`,
        background: copied ? accentColor : "transparent",
        color: copied ? "#fff" : accentColor,
        cursor: "pointer",
        transition: "background 0.2s ease, color 0.2s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "copied" : "copy raw"}
    </button>
  );
}
