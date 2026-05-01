"use client";

/**
 * Toast manager (US-103, US-104, US-105, US-108).
 *
 * Top-right on desktop, top-center on mobile. Single line, Diatype Mono, white
 * bg, hairline border, optional 4px left bar in accent color. Auto-dismiss
 * after 4s, click to dismiss earlier. Stacks vertically.
 */

import { useState, useCallback, useEffect } from "react";
import { FONT_MONO } from "@/lib/admin-styles";

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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "1rem",
        right: isMobile ? "1rem" : "1.5rem",
        left: isMobile ? "1rem" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 1100,
        maxWidth: 360,
        marginLeft: "auto",
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "#fff",
            border: `1px solid ${t.variant === "error" ? "#dc2626" : "rgba(0,0,0,0.75)"}`,
            borderLeft: `4px solid ${t.accentColor || (t.variant === "error" ? "#dc2626" : "#171717")}`,
            padding: "0.6rem 0.9rem",
            fontFamily: FONT_MONO,
            fontSize: "0.8rem",
            color: t.variant === "error" ? "#dc2626" : "var(--text-primary)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
