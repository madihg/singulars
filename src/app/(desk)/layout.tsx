import Chrome from "@/components/desktop/Chrome";

/**
 * The site surfaces: landing, chat, evolution, theme voting. They sit on the
 * dotted desktop ground with the halimmadi.com footer and mascot. Each page
 * renders its own <MenuBar> so the bar can carry that page's anchors.
 */
export default function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Chrome>{children}</Chrome>;
}
