"use client";

/**
 * The furniture that must outlive a route change.
 *
 * This is the fix for the bug where the mascot pill and the site map stopped
 * responding once you moved between pages without a reload. The behaviour for
 * both lives in the canon's desktop.js, which runs ONCE, after hydration, and
 * binds the nodes that exist at that moment. When the menu bar, the footer and
 * the mascot were rendered by each route group's own layout, a client-side
 * navigation out of that group (voting in the landing duel does exactly that:
 * it router.push()es from "(desk)" into "[slug]/(view)") unmounted them and
 * mounted fresh, unbound copies. The markup looked identical and nothing
 * responded to a click.
 *
 * So the bar, the footer and the mascot are rendered here, once, from the root
 * layout. They are never unmounted while the tab lives, and desktop.js's single
 * pass keeps holding. Only the page-local anchors in the middle of the bar
 * change per page; MenuBar portals those into the slot below.
 *
 * The venue screens (/[slug]/stage, /[slug]/control, /timer) are furniture for
 * a room, not pages of the site, and show no chrome. They only HIDE it: the
 * tools window links to /timer with next/link, so a visitor reaches a venue
 * screen without a reload and comes back with the browser's back button. If
 * the chrome were dropped from the tree there, that trip would remount an
 * unbound copy and the bottom menu would die again, one path over from the
 * bug this file exists to fix.
 */

import { usePathname } from "next/navigation";
import { Footer, Mascot, MenuBarShell } from "./Chrome";

const VENUE = [/^\/timer(\/|$)/, /^\/[^/]+\/(stage|control)(\/|$)/];

function isVenue(pathname: string | null): boolean {
  return !!pathname && VENUE.some((re) => re.test(pathname));
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const venue = isVenue(usePathname());
  return (
    <>
      <MenuBarShell hidden={venue} />
      {children}
      <Footer hidden={venue} />
      <Mascot hidden={venue} />
    </>
  );
}
