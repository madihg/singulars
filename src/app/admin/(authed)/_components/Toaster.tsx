"use client";

/**
 * Toast manager (US-103, US-104, US-105, US-108).
 *
 * A small stack of windows in the bottom corner, above the mascot. One line
 * each, in the mono register. Auto-dismiss after 4s, click to dismiss earlier.
 */

import { useState, useCallback } from "react";

export type Toast = {
  id: number;
  text: string;
  variant: "success" | "error";
  accentColor?: string;
};

let nextId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (
      text: string,
      variant: "success" | "error" = "success",
      accentColor?: string,
    ) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, text, variant, accentColor }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    },
    [],
  );

  return { toasts, push, dismiss };
}

export function Toaster({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="sg-toast" aria-live="polite">
      <div className="sg-stack sg-stack--tight">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className="win"
            onClick={() => dismiss(t.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              padding: "0.6rem 0.75rem",
              font: "inherit",
            }}
          >
            <span
              className="k"
              style={{
                color: t.variant === "error" ? "var(--error)" : "var(--ink-50)",
              }}
            >
              {t.variant === "error" ? "error" : "done"}
            </span>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-body)",
                fontSize: "0.92rem",
                color: "var(--ink-85)",
                marginTop: "0.2rem",
              }}
            >
              {t.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
