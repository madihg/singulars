"use client";

/** Copy the raw prompt text to the clipboard. */

import { useState } from "react";

export function CopyButton({
  text,
}: {
  text: string;
  /** Kept for callers that pass a colour; the button uses the page accent. */
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
    <button type="button" className="btn" onClick={handleCopy}>
      {copied ? "copied" : "copy raw"}
    </button>
  );
}
