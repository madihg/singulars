/**
 * /api/admin/auth (US-101) - parallel auth route for the new /admin panel.
 * Same cookie as /api/themes/admin/auth so a single login works across both.
 */

import { NextResponse } from "next/server";
import {
  isValidAdminCookieFromStore,
  setAuthCookie,
  clearAuthCookie,
  verifyPassword,
} from "@/lib/admin-auth";

/** POST /api/admin/auth - validate password and set cookie */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  return setAuthCookie(NextResponse.json({ success: true }));
}

/** DELETE /api/admin/auth - logout */
export async function DELETE() {
  return clearAuthCookie(NextResponse.json({ success: true }));
}

/** GET /api/admin/auth - auth check */
export async function GET() {
  return NextResponse.json({ authenticated: isValidAdminCookieFromStore() });
}
