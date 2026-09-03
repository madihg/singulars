"use client";

/**
 * /admin/login.
 *
 * One centred window with the password field. Lives outside the (authed)
 * route group so the admin nav window does not render here. After a
 * successful auth it navigates to ?from=<path> if provided, else /admin.
 *
 * useSearchParams() must be wrapped in <Suspense> for the build to succeed
 * (Next.js prerender bailout rule).
 */

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="desk">
      <section className="win w--five">
        <div className="win__bar">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <h2 className="win__t">login.txt</h2>
        </div>
        <div className="win__b">{children}</div>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
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
      const res = await fetch("/singulars/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Use a hard navigation so the middleware re-evaluates the cookie.
        window.location.href = from.startsWith("/singulars")
          ? from
          : "/singulars" + from;
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
    <Shell>
      <p className="k">singulars</p>
      <h1 className="disp">admin</h1>
      <div className="rule" />
      <form onSubmit={handleSubmit} className="sg-stack sg-stack--tight">
        <label className="dk-input">
          <span>password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="admin password"
          />
        </label>
        {error ? <p className="sg-err">{error}</p> : null}
        <div className="sg-row sg-row--between">
          {/* next/link prepends basePath, so this must be root-relative. */}
          <Link className="btn" href="/">
            back to singulars
          </Link>
          <button
            type="submit"
            className="btn btn--send"
            disabled={submitting || !password}
          >
            {submitting ? "checking" : "enter"}
          </button>
        </div>
      </form>
    </Shell>
  );
}
