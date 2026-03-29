import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_PASSWORD = process.env.THEME_ADMIN_PASSWORD || "singularpoetics";
const COOKIE_NAME = "theme-admin-token";
const COOKIE_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "singulars-admin-secret";

export function hashToken(): string {
  return crypto
    .createHmac("sha256", COOKIE_SECRET)
    .update(ADMIN_PASSWORD)
    .digest("hex");
}

export function isValidAdminCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return cookieValue === hashToken();
}

/** POST /api/themes/admin/auth - validate password and set cookie */
export async function POST(req: Request) {
  const body = await req.json();
  const { password } = body;

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = hashToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400, // 24 hours
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

/** DELETE /api/themes/admin/auth - clear cookie (logout) */
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

/** GET /api/themes/admin/auth - check if authenticated */
export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  return NextResponse.json({ authenticated: isValidAdminCookie(token) });
}
