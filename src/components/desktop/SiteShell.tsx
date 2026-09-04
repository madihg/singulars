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
 * a room, not pages of the site, and carry no chrome. The only links out of
 * them are plain anchors (a full load), so nothing navigates from a venue
 * screen back into the desk without re-running desktop.js.
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
      {venue ? null : <MenuBarShell />}
      {children}
      {venue ? null : (
        <>
          <Footer />
          <Mascot />
        </>
      )}
    </>
  );
}
