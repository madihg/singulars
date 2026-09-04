import Chrome from "@/components/desktop/Chrome";

/**
 * A performance as a public page: the performance itself, its about page, and
 * a single theme's duel. Its siblings /stage and /control sit outside this
 * group on purpose - they are venue screens with no chrome.
 */
export default function PerformanceViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Chrome>{children}</Chrome>;
}
