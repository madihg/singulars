/**
 * A performance as a public page: the performance itself, its about page, and
 * a single theme's duel. Its siblings /stage and /control sit outside this
 * group on purpose - they are venue screens with no chrome.
 *
 * The chrome itself lives in the root layout (SiteShell), so moving between
 * this group and the desk group never replaces the mascot or the site map.
 */
export default function PerformanceViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
