"use client";

/**
 * Reusable confirm modal for the admin (US-103, US-105, US-108).
 *
 * White bg, hairline border, no shadow, no rounded corners. Two buttons:
 * Cancel (mono link) and Confirm (filled in accentColor). Closes on backdrop
 * click or Escape.
 */

import { useEffect } from "react";
import { FONT_MONO } from "@/lib/admin-styles";

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = "cancel",
  accentColor = "#171717",
  onCancel,
  onConfirm,
  destructive = false,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  accentColor?: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.75)",
          maxWidth: 480,
          width: "100%",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h3
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {title}
        </h3>
        {body ? (
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {body}
          </p>
        ) : null}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              padding: "0.5rem 1rem",
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: FONT_MONO,
              fontSize: "0.85rem",
              padding: "0.5rem 1rem",
              border: `1px solid ${accentColor}`,
              background: destructive ? "#fff" : accentColor,
              color: destructive ? accentColor : "#fff",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
