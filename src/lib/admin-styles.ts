/**
 * Shared admin style primitives (US-102).
 *
 * Lifted from src/app/theme-voting/admin/page.tsx so the existing panel and
 * the new /admin panel share identical visual language. All values match
 * the Singulars + oulipo.xyz design system (see planning/PRD-finetune-and-evals.md
 * §6.5 design system contract).
 *
 * No em dashes anywhere. Uses CSS custom properties from globals.css for color
 * tokens so dark/light/contrast adjustments propagate.
 */

import type { CSSProperties } from "react";

export const FONT_MONO = '"Diatype Mono Variable", monospace';
export const FONT_DISPLAY = '"Terminal Grotesque", sans-serif';
export const FONT_HEADING = '"Diatype Variable", sans-serif';
export const FONT_BODY = '"Standard", sans-serif';

export const monoStyle: CSSProperties = {
  fontFamily: FONT_MONO,
};

export const pageStyle: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "4rem 2rem",
  minHeight: "100vh",
};

export const loginPageStyle: CSSProperties = {
  maxWidth: 400,
  margin: "0 auto",
  padding: "4rem 2rem",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
};

export const titleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: "3.5rem",
  lineHeight: 0.9,
  fontWeight: 400,
  margin: 0,
};

export const heroTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: "7rem",
  lineHeight: 0.9,
  fontWeight: 400,
  margin: 0,
};

export const backLinkStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
  textDecoration: "none",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  fontFamily: FONT_MONO,
  fontSize: "0.95rem",
  padding: "0.75rem 1rem",
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-primary)",
  outline: "none",
};

export const btnPrimaryStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.85rem",
  padding: "0.75rem 1.25rem",
  border: "1px solid var(--text-primary)",
  borderRadius: "8px",
  background: "var(--text-primary)",
  color: "#fff",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

export const btnSecondaryStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.85rem",
  padding: "0.75rem 1.25rem",
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-primary)",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

export const btnSmallStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.75rem",
  padding: "0.4rem 0.75rem",
  border: "1px solid var(--border-light)",
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "border-color 0.15s ease",
};

export const actionBtnStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.75rem",
  padding: "0.35rem 0.6rem",
  border: "1px solid var(--border-light)",
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

export const sectionHeadingStyle: CSSProperties = {
  fontFamily: FONT_HEADING,
  fontSize: "1.25rem",
  fontWeight: 600,
  margin: 0,
};

export const statCardStyle: CSSProperties = {
  border: "1px solid var(--border-light)",
  borderRadius: "8px",
  padding: "1rem 1.25rem",
};

export const statValueStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "2rem",
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: "0.25rem",
};

export const statLabelStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.75rem",
  color: "var(--text-hint)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const doneBadgeStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.65rem",
  color: "var(--text-hint)",
  marginLeft: "0.5rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const errorTextStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "0.85rem",
  color: "#dc2626",
  margin: 0,
};

/** Status pill geometry from §6.5 design contract. */
export const statusPillStyle = (
  variant:
    | "upcoming"
    | "training"
    | "trained"
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "draft"
    | "published"
    | "queued"
    | "succeeded"
    | "validating",
): CSSProperties => {
  const map: Record<
    typeof variant,
    { bg: string; border: string; color: string }
  > = {
    upcoming: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
    training: { bg: "#ffffff", border: "#171717", color: "#171717" },
    trained: { bg: "#171717", border: "#171717", color: "#ffffff" },
    pending: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
    running: { bg: "#ffffff", border: "#171717", color: "#171717" },
    completed: { bg: "#ffffff", border: "#171717", color: "#171717" },
    failed: { bg: "#ffffff", border: "#dc2626", color: "#dc2626" },
    cancelled: { bg: "#f3f4f6", border: "#d1d5db", color: "#6b7280" },
    draft: { bg: "#ffffff", border: "#d1d5db", color: "#6b7280" },
    published: { bg: "#171717", border: "#171717", color: "#ffffff" },
    queued: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
    succeeded: { bg: "#171717", border: "#171717", color: "#ffffff" },
    validating: { bg: "#ffffff", border: "#171717", color: "#171717" },
  };
  const tones = map[variant];
  return {
    fontFamily: FONT_MONO,
    fontSize: "0.7rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "0.25rem 0.7rem",
    borderRadius: "2px",
    background: tones.bg,
    border: `1px solid ${tones.border}`,
    color: tones.color,
    display: "inline-block",
    whiteSpace: "nowrap",
  };
};

/** Hairline divider between content rows. */
export const hairlineStyle: CSSProperties = {
  border: 0,
  borderTop: "1px solid var(--border-light)",
  margin: "2rem 0",
};

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}
