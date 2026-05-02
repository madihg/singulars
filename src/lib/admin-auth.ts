/**
 * Shared admin auth (US-101).
 *
 * Both /theme-voting/admin and the new /admin panel use the same cookie
 * (`theme-admin-token`) so a single login session works across both.
 *
 * Algorithm (lifted from src/app/api/themes/admin/auth/route.ts):
 *   token = HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD)
 *
 * Password precedence: ADMIN_PASSWORD > THEME_ADMIN_PASSWORD > "singularpoetics".
 * The service-role key is the HMAC key; it is never sent to the client.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const COOKIE_NAME = "theme-admin-token";
export const COOKIE_MAX_AGE_SECONDS = 86_400; // 24h

function getAdminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.THEME_ADMIN_PASSWORD ||
    "singularpoetics"
  );
}

function getCookieSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "singulars-admin-secret";
}

/** Compute the HMAC token that valid cookies must match. */
export function hashToken(): string {
  return crypto
    .createHmac("sha256", getCookieSecret())
    .update(getAdminPassword())
    .digest("hex");
}

/**
 * Pure check: does this cookie value match the expected HMAC?
 * Accepts either a raw string (the existing /theme-voting/admin caller pattern)
 * or a Request object (new /admin caller pattern).
 */
export function isValidAdminCookie(
  input: string | undefined | Request,
): boolean {
  if (!input) return false;
  if (typeof input === "string") {
    return input === hashToken();
  }
  // Request object - read cookie via headers
  const cookieHeader = input.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  );
  return !!match && match[1] === hashToken();
}

/**
 * Read the cookie via Next.js cookies() helper (Server Components / route
 * handlers without an explicit Request).
 */
export function isValidAdminCookieFromStore(): boolean {
  const token = cookies().get(COOKIE_NAME)?.value;
  return isValidAdminCookie(token);
}

/**
 * Returns null when authenticated, otherwise a 401 NextResponse the route
 * handler can `return` directly.
 *
 * Usage:
 *   const denied = requireAuth(req);
 *   if (denied) return denied;
 */
export function requireAuth(req: Request): NextResponse | null {
  if (isValidAdminCookie(req)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Throwing variant for callers that prefer try/catch flow.
 * The thrown error carries a `.toResponse()` shortcut.
 */
export class AdminAuthError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "AdminAuthError";
  }
  toResponse(): NextResponse {
    return NextResponse.json({ error: this.message }, { status: 401 });
  }
}

export function requireAuthOrThrow(req: Request): void {
  if (!isValidAdminCookie(req)) {
    throw new AdminAuthError();
  }
}

/** Mutate the response to set the auth cookie. */
export function setAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, hashToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** Mutate the response to clear the auth cookie (logout). */
export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/** Compare a submitted password against the configured one (constant-time). */
export function verifyPassword(submitted: string): boolean {
  const expected = getAdminPassword();
  if (submitted.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
}
