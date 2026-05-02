/**
 * Admin audit log (v1).
 *
 * v1 logs every vote-count override to console with structured JSON. v2 will
 * promote this to a `poem_vote_overrides` table (see PRD open question §9.4).
 *
 * Format mirrors what an aggregator like Datadog or Vercel Logs can parse:
 *   {"audit":"poem.vote_count","poem_id":"...","old":N,"new":M,"reason":"...","by":"...","ts":"..."}
 */

import crypto from "crypto";
import { COOKIE_NAME } from "./admin-auth";

export type AuditEvent = {
  audit: string;
  ts: string;
  by: string | null;
  [k: string]: unknown;
};

/** Stable per-cookie hash so repeat actions cluster in logs without leaking the cookie. */
export function userHashFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  return crypto.createHash("sha256").update(m[1]).digest("hex").slice(0, 12);
}

export function audit(
  event: { audit: string; by: string | null } & Record<string, unknown>,
): void {
  const line: AuditEvent = {
    ...event,
    ts: (event.ts as string) || new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
