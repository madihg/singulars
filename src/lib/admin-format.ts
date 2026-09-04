/**
 * Formatting helpers for the admin surface.
 *
 * This file used to hold the admin's own style objects. The Desktop reskin
 * moved all of that into the canon (src/app/desktop/desktop.css) and the
 * page-scoped rules in src/app/desktop/pages.css, so nothing here describes
 * appearance any more - only how a timestamp reads in a ledger row.
 */

/** A relative time for recent events, a short date for older ones. */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}
