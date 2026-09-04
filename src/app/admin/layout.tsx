import { MenuBar } from "@/components/desktop/Chrome";

/**
 * /admin shell.
 *
 * The admin surface is part of the same site, so it wears the same chrome: the
 * halimmadi.com menu bar at the top, the one-line footer at the bottom, the
 * mascot in the corner - all of it from the root layout's SiteShell. It is compact by design - the destinations live in the
 * "admin/" window rendered by the (authed) layout, not in the menu bar.
 *
 * /admin/login sits under this layout too but outside (authed), so it gets the
 * chrome without the nav window.
 */

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MenuBar menu={[{ href: "/singulars/", label: "singulars" }]} />
      {children}
    </>
  );
}
