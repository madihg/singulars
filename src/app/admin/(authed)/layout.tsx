/**
 * /admin (authed) layout (US-102).
 *
 * Route group (authed) wraps every admin page that needs the nav. The login
 * page lives at /admin/login (outside this group) so it renders without nav
 * chrome - mirroring /theme-voting/admin's centred login.
 *
 * Auth gating happens in src/middleware.ts before this layout renders.
 * Layout's job is to add the nav + page chrome around children.
 */

import { AdminNav } from "./AdminNav";
import { pageStyle } from "@/lib/admin-styles";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={pageStyle}>
      <AdminNav />
      <main>{children}</main>
    </div>
  );
}
