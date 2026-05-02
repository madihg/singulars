"use client";

/**
 * /admin/login (US-102).
 *
 * Mirrors /theme-voting/admin's centred login. Lives outside the (authed)
 * route group so the AdminNav does not render here. After successful auth,
 * navigates to ?from=<path> if provided, else /admin.
 *
 * useSearchParams() must be wrapped in <Suspense> for the build to succeed
 * (Next.js prerender bailout rule).
 */

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loginPageStyle,
  titleStyle,
  inputStyle,
  btnPrimaryStyle,
  errorTextStyle,
  backLinkStyle,
  monoStyle,
} from "@/lib/admin-styles";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={loginPageStyle} />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const search = useSearchParams();
  const from = search?.get("from") || "/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Use a hard navigation so the middleware re-evaluates the cookie.
        window.location.href = from;
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json?.error || "wrong password");
    } catch {
      setError("network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={loginPageStyle}>
      <h1 style={titleStyle}>admin</h1>
      <p
        style={{
          ...monoStyle,
          color: "var(--text-secondary)",
          fontSize: "0.85rem",
          margin: 0,
        }}
      >
        password
      </p>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          aria-label="admin password"
        />
        {error ? <p style={errorTextStyle}>{error}</p> : null}
        <button
          type="submit"
          style={btnPrimaryStyle}
          disabled={submitting || !password}
        >
          {submitting ? "..." : "enter"}
        </button>
      </form>
      <Link href="/singulars" style={backLinkStyle}>
        ← back to singulars
      </Link>
    </div>
  );
}
