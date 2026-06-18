import { getAdminPassword } from "./admin-auth";

/**
 * The /[slug]/control surface and its write API are gated by a `?key=`.
 *
 * A key is valid if it matches a dedicated STAGE_CONTROL_KEY env var (when
 * set) OR the existing admin password. The admin-password fallback means the
 * operator can open control with credentials they already have, without
 * needing a separate env var configured in Vercel. Set STAGE_CONTROL_KEY in
 * prod later if you want a dedicated, narrower secret.
 */
export function isStageControlKeyValid(
  key: string | null | undefined,
): boolean {
  if (!key) return false;
  const dedicated = process.env.STAGE_CONTROL_KEY;
  if (dedicated && key === dedicated) return true;
  return key === getAdminPassword();
}
