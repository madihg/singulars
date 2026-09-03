"use client";

/**
 * The "admin/" window: every admin destination as a ledger row.
 *
 * Rows are grouped under mono .k labels, the way the canon groups a file
 * ledger: live (dashboard, control), data (performances, themes, models),
 * pipeline (eval runs, fine-tunes, training data, publish). The current page
 * carries aria-current and a vermilion dot. Logout sits at the foot.
 *
 * Adding a destination is one line in GROUPS.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Tab = { href: string; label: string };
type Group = { label: string; tabs: Tab[] };

const GROUPS: Group[] = [
  {
    label: "live",
    tabs: [
      { href: "/admin", label: "dashboard" },
      { href: "/admin/control", label: "control" },
    ],
  },
  {
    label: "data",
    tabs: [
      { href: "/admin/performances", label: "performances" },
      { href: "/admin/themes", label: "themes" },
      { href: "/admin/models", label: "models" },
    ],
  },
  {
    label: "pipeline",
    tabs: [
      { href: "/admin/eval-runs", label: "eval runs" },
      { href: "/admin/fine-tunes", label: "fine-tunes" },
      { href: "/admin/training-data", label: "training data" },
      { href: "/admin/publish", label: "publish" },
      { href: "/admin/system-prompts", label: "system prompts" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/singulars/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <nav className="win w--four" aria-label="admin">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">admin/</h2>
      </div>
      <div className="win__b">
        <div className="sg-nav">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <span className="k">{group.label}</span>
              {group.tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive(tab.href) ? "page" : undefined}
                >
                  <i className="cdot" />
                  {tab.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="rule" />
        <button
          type="button"
          className="btn"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "logging out" : "log out"}
        </button>
      </div>
    </nav>
  );
}
