/**
 * /admin (authed) layout.
 *
 * Route group (authed) wraps every admin page that needs the nav window. The
 * login page lives at /admin/login (outside this group) so it renders without
 * it, while still getting the site chrome from /admin/layout.tsx.
 *
 * Auth gating happens in src/middleware.ts before this layout renders. This
 * layout's only job is the desk: the "admin/" nav window, then the page's own
 * windows as siblings on the same 12-column grid.
 */

import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="desk">
      <AdminNav />
      {children}
    </main>
  );
}
