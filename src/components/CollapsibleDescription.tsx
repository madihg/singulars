"use client";

import { useState } from "react";
import PerformanceContentBlocks from "./PerformanceContentBlocks";
import type { PerformanceDescription } from "@/lib/performance-descriptions";

interface Props {
  content: PerformanceDescription["content"];
  performanceColor: string;
  a11yColor: string;
  /** Start expanded (default true). Voting pages can pass false to keep focus. */
  defaultOpen?: boolean;
  /** Optional anchor id so a CTA elsewhere can scroll to this section. */
  id?: string;
}

/**
 * Collapsible wrapper around <PerformanceContentBlocks>.
 *
 * Default state: EXPANDED — content stays in the DOM so search engines and
 * screen readers can read it. The toggle is for returning visitors who
 * already know the description and want to scroll past it without using
 * the "read the poems ↓" jump anchor at the top.
 *
 * Animation: simple max-height transition via CSS. The chevron rotates.
 */
export default function CollapsibleDescription({
  content,
  performanceColor,
  a11yColor,
  defaultOpen = true,
  id,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      id={id}
      style={{ marginBottom: "3rem", scrollMarginTop: "1.5rem" }}
      aria-label="About this performance"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="performance-description-body"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.85rem 0",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${open ? performanceColor : "rgba(0,0,0,0.12)"}`,
          cursor: "pointer",
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.85rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: open ? a11yColor : "rgba(0,0,0,0.6)",
          textAlign: "left",
          transition: "color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <span>about this performance</span>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            fontSize: "0.75rem",
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>

      <div
        id="performance-description-body"
        hidden={!open}
        style={{ paddingTop: open ? "1.5rem" : 0 }}
      >
        <PerformanceContentBlocks content={content} />
        <div style={{ textAlign: "right", marginTop: "1rem" }}>
          <a
            href="#themes"
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.8rem",
              color: a11yColor,
              textDecoration: "none",
              borderBottom: `1px solid ${performanceColor}`,
              paddingBottom: "2px",
            }}
          >
            read the poems ↓
          </a>
        </div>
      </div>
    </section>
  );
}
