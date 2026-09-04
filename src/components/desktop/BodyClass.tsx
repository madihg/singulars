"use client";

import { useEffect } from "react";

/**
 * Adds a class to <body> for the life of the route that renders it.
 *
 * The root layout puts "desktop acc-machine" on the body once, for the whole
 * app. The venue screens (/[slug]/stage, /[slug]/control, /timer) are furniture
 * for a room rather than pages of the site: they add "venue", which paints the
 * ground black and drops the dotted paper. A server layout cannot reach the
 * body element of a layout above it, so this does it on mount and takes the
 * class back off when the route unmounts.
 */
export default function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const names = className.split(/\s+/).filter(Boolean);
    document.body.classList.add(...names);
    return () => document.body.classList.remove(...names);
  }, [className]);
  return null;
}
