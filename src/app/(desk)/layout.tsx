/**
 * The site surfaces: landing, chat, evolution, theme voting. They sit on the
 * dotted desktop ground; the menu bar, the footer and the mascot come from the
 * root layout's SiteShell, so they survive a client-side navigation. Each page
 * still renders its own <MenuBar> with its own anchors, the way each canon page
 * does - those links portal into the bar the root layout holds open.
 */
export default function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
