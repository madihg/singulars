import type { Metadata } from "next";
import Script from "next/script";
import SiteShell from "@/components/desktop/SiteShell";
import "./globals.css";
import "./desktop/tokens.css";
import "./desktop/desktop.css";
import "./desktop/pages.css";

/*
 * Singulars wears the Desktop language of halimmadi.com (halim-madi:
 * DESIGN-DESKTOP.md). The body carries "desktop acc-machine": machine poetry
 * wears vermilion, and cobalt stays the one bold note on the
 * start-a-conversation CTA.
 *
 * Stylesheet order is load-bearing: globals.css is reset and font faces only,
 * then the canon tokens, then the canon rules, then this app's page-scoped
 * composition. desktop.js is the canon's shared behaviour (mascot, site map,
 * draggable windows, rotator); it lives under public/ because Next only serves
 * static scripts from there, and is kept byte-identical by
 * scripts/sync-desktop.mjs.
 */

export const metadata: Metadata = {
  title: "Singulars - human and machine poetry performances",
  description:
    "A series of live performances by Halim Madi where a poet writes against a machine and the audience votes. The votes train the next machine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="desktop acc-machine">
        <SiteShell>{children}</SiteShell>
        {/* basePath is applied by hand: next/script does not prefix src. */}
        <Script src="/singulars/desktop/desktop.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
