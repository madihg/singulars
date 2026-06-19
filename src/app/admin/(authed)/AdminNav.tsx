"use client";

/**
 * /admin left sidebar navigation.
 *
 * Vertical sidebar (was a horizontal top tab-row, which got crowded). Items are
 * grouped under small section labels so the list reads at a glance:
 *   live     - dashboard, control
 *   data     - performances, themes, models
 *   pipeline - eval runs, fine-tunes, training data, publish
 * Logout is pinned to the bottom.
 *
 * Layout + responsive behaviour live in the scoped <style> block below (inline
 * styles can't express media queries, and the sidebar must collapse to a
 * horizontal scroll row on narrow screens). Active item: left accent border +
 * full opacity + a faint background.
 *
 * Adding a nav item is one line in GROUPS.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FONT_MONO } from "@/lib/admin-styles";

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
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <aside className="admin-sidebar" aria-label="admin">
      <Link href="/admin" className="admin-wordmark">
        admin
      </Link>

      <nav className="admin-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="admin-nav-group">
            <div className="admin-nav-grouplabel">{group.label}</div>
            {group.tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="admin-nav-link"
                data-active={isActive(tab.href)}
                aria-current={isActive(tab.href) ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="admin-logout"
      >
        {loggingOut ? "logging out..." : "logout"}
      </button>

      <style>{`
        .admin-shell {
          display: flex;
          align-items: stretch;
          min-height: 100vh;
        }
        .admin-sidebar {
          width: 220px;
          flex-shrink: 0;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 2.5rem 1.5rem;
          border-right: 1px solid var(--border-light);
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          font-family: ${FONT_MONO};
        }
        .admin-wordmark {
          font-family: "Terminal Grotesque", sans-serif;
          font-size: 1.6rem;
          letter-spacing: 0.02em;
          text-decoration: none;
          color: var(--text-primary);
          margin-bottom: 1.5rem;
        }
        .admin-nav { display: flex; flex-direction: column; }
        .admin-nav-group { display: flex; flex-direction: column; }
        .admin-nav-grouplabel {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--text-hint);
          margin: 1.25rem 0 0.45rem 0.6rem;
        }
        .admin-nav-link {
          display: block;
          font-size: 0.9rem;
          text-decoration: none;
          color: var(--text-primary);
          opacity: 0.72;
          padding: 0.4rem 0.6rem;
          border-left: 2px solid transparent;
          transition: opacity 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .admin-nav-link:hover { opacity: 1; }
        .admin-nav-link:focus-visible,
        .admin-logout:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
          opacity: 1;
        }
        .admin-nav-link[data-active="true"] {
          opacity: 1;
          border-left-color: currentColor;
          background: var(--border-light);
        }
        .admin-logout {
          margin-top: auto;
          align-self: flex-start;
          background: transparent;
          border: none;
          padding: 0.6rem;
          font-family: ${FONT_MONO};
          font-size: 0.85rem;
          color: var(--text-secondary);
          cursor: pointer;
          opacity: 1;
          transition: opacity 0.2s ease;
        }
        .admin-logout:disabled { opacity: 0.5; cursor: default; }
        .admin-main {
          flex: 1;
          min-width: 0;
          box-sizing: border-box;
          max-width: 1000px;
          padding: 3rem 2.5rem;
        }
        @media (max-width: 760px) {
          .admin-shell { flex-direction: column; }
          .admin-sidebar {
            width: 100%;
            height: auto;
            position: static;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.25rem 0.75rem;
            padding: 1.25rem;
            border-right: none;
            border-bottom: 1px solid var(--border-light);
          }
          .admin-wordmark { margin-bottom: 0; margin-right: 0.5rem; }
          .admin-nav { flex-direction: row; flex-wrap: wrap; gap: 0 0.5rem; }
          .admin-nav-group { flex-direction: row; align-items: center; gap: 0.5rem; }
          .admin-nav-grouplabel { display: none; }
          .admin-nav-link {
            border-left: none;
            border-bottom: 2px solid transparent;
            padding: 0.25rem 0.3rem;
          }
          .admin-nav-link[data-active="true"] {
            background: transparent;
            border-bottom-color: currentColor;
          }
          .admin-logout { margin-top: 0; margin-left: auto; }
          .admin-main { padding: 2rem 1.25rem; max-width: none; }
        }
      `}</style>
    </aside>
  );
}
