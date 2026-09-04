"use client";

import { useEffect, useState } from "react";
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
 * The "about this performance" window.
 *
 * Content stays in the DOM whether the window is open or shut, so search
 * engines and screen readers read it either way. The bar doubles as the
 * toggle, the way a window titlebar does. Linking to #<id> opens it and
 * scrolls to it.
 */
export default function CollapsibleDescription({
  content,
  defaultOpen = true,
  id,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-expand when linked to via #<id> (e.g. a "read more about the piece"
  // CTA -> "#about"), and scroll it into view. Covers both initial load with
  // the hash and in-page hash changes.
  useEffect(() => {
    if (!id) return;
    const openIfHash = () => {
      if (window.location.hash === `#${id}`) {
        setOpen(true);
        // let the section paint before scrolling
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }, 60);
      }
    };
    openIfHash();
    window.addEventListener("hashchange", openIfHash);
    return () => window.removeEventListener("hashchange", openIfHash);
  }, [id]);

  return (
    <section
      className="win w--seven"
      id={id}
      aria-label="about this performance"
    >
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">about-this-performance.txt</h2>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="performance-description-body"
          style={{ marginLeft: "auto" }}
        >
          {open ? "collapse" : "expand"}
        </button>
      </div>

      <div
        className="win__b"
        id="performance-description-body"
        hidden={!open}
      >
        <PerformanceContentBlocks content={content} />
        <div className="sg-row sg-row--end" style={{ marginTop: "0.9rem" }}>
          <a className="btn" href="#themes">
            read the poems &darr;
          </a>
        </div>
      </div>
    </section>
  );
}
