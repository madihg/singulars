"use client";

/**
 * /admin top navigation (US-102).
 *
 * Horizontal row of Diatype Mono links on desktop. On mobile (<600px) the nav
 * collapses to a single line of comma-separated links - no hamburger drawer.
 * Active tab gets bottom border + full opacity; inactive tabs at 0.6 opacity.
 *
 * Tab list is an array so adding nav items in Phase 2.5 (Training data,
 * Fine-tunes) is one line per item.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FONT_MONO } from "@/lib/admin-styles";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/admin", label: "dashboard" },
  { href: "/admin/performances", label: "performances" },
  { href: "/admin/models", label: "models" },
  { href: "/admin/eval-runs", label: "eval runs" },
  { href: "/admin/publish", label: "publish" },
  { href: "/admin/training-data", label: "training data" },
  { href: "/admin/fine-tunes", label: "fine-tunes" },
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
    <nav
      aria-label="admin"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "1.25rem",
        padding: "0 0 1.5rem 0",
        borderBottom: "1px solid var(--border-light)",
        marginBottom: "2rem",
        fontFamily: FONT_MONO,
        fontSize: "0.85rem",
      }}
    >
      <Link
        href="/admin"
        style={{
          fontFamily: '"Terminal Grotesque", sans-serif',
          fontSize: "1.4rem",
          textDecoration: "none",
          color: "var(--text-primary)",
          marginRight: "0.5rem",
          letterSpacing: "0.02em",
        }}
      >
        admin
      </Link>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          style={{
            textDecoration: "none",
            color: "var(--text-primary)",
            opacity: isActive(tab.href) ? 1 : 0.6,
            paddingBottom: "0.25rem",
            borderBottom: isActive(tab.href)
              ? "2px solid currentColor"
              : "2px solid transparent",
            transition: "opacity 0.3s ease, border-color 0.3s ease",
          }}
        >
          {tab.label}
        </Link>
      ))}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          marginLeft: "auto",
          background: "transparent",
          border: "none",
          padding: 0,
          fontFamily: FONT_MONO,
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          cursor: "pointer",
          opacity: loggingOut ? 0.5 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        {loggingOut ? "logging out..." : "logout"}
      </button>
    </nav>
  );
}
