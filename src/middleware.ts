/**
 * Admin auth middleware (US-102).
 *
 * Guards every /admin/* route except /admin/login and /api/admin/auth. Unauthed
 * visitors are redirected to /admin/login?from=<original-path> so they land
 * back where they came from after login.
 *
 * The middleware runs on the edge by default; it does ONLY a cookie-presence
 * check (no HMAC validation here - that needs Node crypto). Route handlers
 * still call requireAuth(req) to do the real check. Two-layer defense:
 *   1. middleware: fast bounce for missing-cookie cases (unauthed visitor)
 *   2. route handler: cryptographic validation (tampered cookie)
 */

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const guarded =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!guarded) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cookie presence check only - real validation happens in routes / layouts.
  const token = req.cookies.get("theme-admin-token")?.value;
  if (token && token.length > 0) {
    return NextResponse.next();
  }

  // For API routes, return 401 JSON instead of redirecting.
  if (pathname.startsWith("/api/admin")) {
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
