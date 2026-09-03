"use client";

/**
 * The confirm dialog for dangerous admin actions.
 *
 * A window in the middle of the desk, over a dimmed ground. Cancel is a plain
 * .btn, confirm is the cobalt .btn--send unless the action is destructive, in
 * which case it is the vermilion .btn--danger. Closes on backdrop click or
 * Escape.
 */

import { useEffect } from "react";

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = "cancel",
  onCancel,
  onConfirm,
  destructive = false,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Kept for callers that pass a performance colour; the window uses the
   *  page accent instead, so this is accepted and ignored. */
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
    <div className="sg-modal" onClick={onCancel}>
      <div
        className="win sg-modal__w"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="win__bar">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <h3 className="win__t">confirm.txt</h3>
        </div>
        <div className="win__b">
          <p className="h2">{title}</p>
          {body ? <p className="note">{body}</p> : null}
          <div className="sg-row sg-row--end" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={destructive ? "btn btn--danger" : "btn btn--send"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
