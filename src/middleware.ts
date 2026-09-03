/**
 * Admin auth middleware (US-102).
 *
 * Guards every /admin/* page and every /api/admin/* route except the public
 * paths listed below. Unauthed visitors are redirected to
 * /admin/login?from=<original-path> so they land back where they came from
 * after login.
 *
 * basePath note: next.config.mjs sets basePath "/singulars", and both the
 * middleware matcher and req.nextUrl.pathname are basePath-relative - Next
 * strips "/singulars" before either is evaluated. So every path here is
 * written WITHOUT the basePath. (Client-side fetch() strings elsewhere in the
 * app do keep the "/singulars" prefix; those are real browser URLs.)
 *
 * The middleware runs on the edge by default; it does ONLY a cookie-presence
 * check (no HMAC validation here - that needs Node crypto). Route handlers
 * still call requireAuth(req) to do the real check. Two-layer defense:
 *   1. middleware: fast bounce for missing-cookie cases (unauthed visitor)
 *   2. route handler: cryptographic validation (tampered cookie)
 */

import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths under the guarded prefixes that must stay reachable without the admin
 * cookie. Each one carries its own auth:
 *   /admin/login, /api/admin/auth      - the login surface itself
 *   /api/admin/cron/*                  - Vercel cron; checks x-vercel-cron
 *   /api/admin/fine-tunes/webhooks/*   - provider callbacks; verify the
 *                                        provider signature, but ONLY when
 *                                        OPENAI_WEBHOOK_SECRET /
 *                                        TOGETHER_WEBHOOK_SECRET is set. Set
 *                                        both in Vercel: unset, these are
 *                                        open write endpoints. See
 *                                        docs/DEPLOYMENT.md.
 */
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/api/admin/auth",
  "/api/admin/cron",
  "/api/admin/fine-tunes/webhooks",
];

function isApiAdmin(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isPageAdmin(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isPageAdmin(pathname) && !isApiAdmin(pathname)) {
    return NextResponse.next();
  }
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Cookie presence check only - real validation happens in routes / layouts.
  const token = req.cookies.get("theme-admin-token")?.value;
  if (token && token.length > 0) {
    return NextResponse.next();
  }

  // For API routes, return 401 JSON instead of redirecting.
  if (isApiAdmin(pathname)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // For pages, redirect to login with the original path captured.
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?from=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
