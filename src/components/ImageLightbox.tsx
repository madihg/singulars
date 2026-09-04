"use client";

/**
 * Full-screen image carousel for performance pages.
 *
 * Mounted once per page. Instead of restructuring the (server-rendered) image
 * markup, it discovers images by the `data-lightbox` attribute and uses event
 * delegation, so it also catches images that mount later - e.g. the gallery
 * inside the collapsible description once it expands. The list is recomputed on
 * every open, in DOM order, so arrow keys walk the page top to bottom.
 *
 * Controls: click / Enter / Space to open, arrow keys or the on-screen chevrons
 * to move (wrapping at both ends), Escape or a backdrop click to close, swipe on
 * touch. Focus returns to the image you opened from.
 *
 * Design system: near-black backdrop, hairline controls, no rounded corners,
 * Diatype Mono for the counter/caption, the performance color as the only
 * accent (on hover/focus). Pictures are in colour on the page and in colour
 * here; the lightbox is for size, not for a reveal.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MONO = '"Diatype Mono Variable", monospace';
const SELECTOR = "img[data-lightbox]";

type Item = { src: string; alt: string };

/** Only allow a simple hex colour through: `tone` is interpolated into a
 *  <style> block, and a stray brace in a DB value would break out of it. */
function safeTone(input?: string): string {
  return input && /^#[0-9a-f]{3,8}$/i.test(input.trim())
    ? input.trim()
    : "#ffffff";
}

export default function ImageLightbox({ accent }: { accent?: string }) {
  const tone = safeTone(accent);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const touchX = useRef<number | null>(null);
  // Mirrors `index !== null` for the always-on document listeners, so they can
  // bail while the dialog is up without re-subscribing on every step.
  const openRef = useRef(false);

  const open = useCallback((img: HTMLImageElement) => {
    // Only images actually rendered on the page. CollapsibleDescription keeps
    // its content in the DOM when collapsed (hidden attribute, for SEO and
    // screen readers), so without this filter the carousel would walk through
    // images the visitor cannot see. getClientRects() is empty for anything
    // display:none, whatever put it there.
    const rendered = Array.from(
      document.querySelectorAll<HTMLImageElement>(SELECTOR),
    ).filter((el) => el.getClientRects().length > 0);

    // De-dupe by resolved src: some performances use the same photo as both the
    // hero and a description image, and the same slide twice reads as a bug.
    const srcOf = (el: HTMLImageElement) => el.currentSrc || el.src;
    const seen = new Set<string>();
    const list: Item[] = [];
    for (const el of rendered) {
      const src = srcOf(el);
      if (seen.has(src)) continue;
      seen.add(src);
      list.push({ src, alt: el.alt || "" });
    }

    const i = list.findIndex((it) => it.src === srcOf(img));
    if (i < 0) return;
    triggerRef.current = img;
    setItems(list);
    setIndex(i);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    // Hand focus back to the image that opened the carousel.
    const t = triggerRef.current;
    triggerRef.current = null;
    if (t && document.contains(t)) t.focus?.();
  }, []);

  const step = useCallback((delta: number) => {
    setIndex((cur) => {
      if (cur === null) return cur;
      const n = items.length;
      if (n === 0) return cur;
      return (cur + delta + n) % n; // wrap around
    });
  }, [items.length]);

  // Open on click, or Enter/Space when an image has keyboard focus. Both bail
  // while the carousel is already open: without a focus trap, Tab can reach an
  // image on the page behind, and Enter there would otherwise re-open onto a
  // different slide.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (openRef.current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const img = (e.target as HTMLElement | null)?.closest<HTMLImageElement>(
        SELECTOR,
      );
      if (!img) return;
      e.preventDefault();
      open(img);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (openRef.current) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const img = (e.target as HTMLElement | null)?.closest<HTMLImageElement>(
        SELECTOR,
      );
      if (!img) return;
      e.preventDefault();
      open(img);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Carousel keyboard controls (only while open).
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowRight":
          e.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          step(-1);
          break;
        case "Home":
          e.preventDefault();
          setIndex(0);
          break;
        case "End":
          e.preventDefault();
          setIndex(items.length - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, close, step]);

  // Lock body scroll while open, compensating for the scrollbar so the page
  // behind doesn't shift.
  const isOpen = index !== null;
  openRef.current = isOpen; // idempotent mirror of state for the doc listeners
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [isOpen]);

  // Move focus into the dialog so keys land here and screen readers announce it.
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  // Warm the neighbours so stepping is instant.
  useEffect(() => {
    if (index === null || items.length < 2) return;
    for (const d of [1, -1]) {
      const nb = items[(index + d + items.length) % items.length];
      if (nb) {
        const pre = new window.Image();
        pre.src = nb.src;
      }
    }
  }, [index, items]);

  if (index === null) return null;
  const current = items[index];
  if (!current) return null;
  const many = items.length > 1;

  const ctrl = {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.28)",
    color: "#fff",
    fontFamily: MONO,
    cursor: "pointer",
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  } as const;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      onClick={(e) => {
        // Click anywhere that isn't the photo or a control closes. Testing the
        // target against the dialog itself does NOT work here: the bars and the
        // stage tile the overlay completely, so the dialog is never the direct
        // target and backdrop-to-close would silently never fire.
        const t = e.target as HTMLElement | null;
        if (t?.closest("button") || t?.closest("img")) return;
        close();
      }}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null || !many) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.94)",
        display: "flex",
        flexDirection: "column",
        outline: "none",
        // iOS Safari ignores body overflow:hidden for touch; this stops the
        // page behind from dragging under the overlay while swiping.
        touchAction: "none",
      }}
    >
      {/* Step changes must be spoken: the dialog keeps focus, and screen
          readers do not re-announce a changed label on a focused element. */}
      <span
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {`Image ${index + 1} of ${items.length}${current.alt ? `: ${current.alt}` : ""}`}
      </span>
      <style>{`
        .lb-ctrl:hover, .lb-ctrl:focus-visible {
          border-color: ${tone} !important;
          color: ${tone} !important;
          outline: none;
        }
        .lb-stage { animation: lb-in 160ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .lb-stage { animation: none; }
        }
        @keyframes lb-in { from { opacity: 0 } to { opacity: 1 } }
        @media (max-width: 600px) {
          .lb-arrow { width: 40px !important; height: 40px !important; }
          .lb-bar { padding: 0.85rem 1rem !important; }
        }
      `}</style>

      {/* Top bar: counter + close */}
      <div
        className="lb-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1.25rem 1.5rem",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          <span style={{ color: tone }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          {" / "}
          {String(items.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="lb-ctrl"
          onClick={close}
          aria-label="Close"
          style={{ ...ctrl, width: 36, height: 36, fontSize: "1rem" }}
        >
          ✕
        </button>
      </div>

      {/* Stage: prev / image / next */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0 1.5rem",
        }}
      >
        {many && (
          <button
            type="button"
            className="lb-ctrl lb-arrow"
            onClick={() => step(-1)}
            aria-label="Previous image"
            style={{ ...ctrl, width: 48, height: 48, fontSize: "1.1rem" }}
          >
            ‹
          </button>
        )}

        <div
          className="lb-stage"
          key={current.src}
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt}
            decoding="async"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {many && (
          <button
            type="button"
            className="lb-ctrl lb-arrow"
            onClick={() => step(1)}
            aria-label="Next image"
            style={{ ...ctrl, width: 48, height: 48, fontSize: "1.1rem" }}
          >
            ›
          </button>
        )}
      </div>

      {/* Caption + hint */}
      <div
        className="lb-bar"
        style={{
          flexShrink: 0,
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1.5rem",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: MONO,
            fontSize: "0.8rem",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.7)",
            minWidth: 0,
          }}
        >
          {current.alt}
        </span>
        {many && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              whiteSpace: "nowrap",
            }}
          >
            ← → to browse · esc to close
          </span>
        )}
      </div>
    </div>
  );
}
