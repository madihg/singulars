/**
 * POST /api/admin/eval-runs/[id]/_run (US-111)
 *
 * Vercel-side runner invocation. Shells out to scripts/run-eval.ts via tsx
 * with --run-id <id>. Marked nodejs runtime + maxDuration 300 so a
 * single-candidate eval has 5 minutes wall-clock.
 *
 * In environments without tsx installed (or without API keys), the script
 * fails and writes status='failed' + error_message; we just return 200 so
 * the caller (start route) does not retry.
 */

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { requireAuth } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  // Fire and forget the runner subprocess. We do NOT await the promise; the
  // runner writes its own status updates back to the eval_runs row.
  try {
    const child = spawn(
      "npx",
      ["tsx", "scripts/run-eval.ts", "--run-id", params.id],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      },
    );
    child.unref();
  } catch {
    return NextResponse.json(
      { ok: false, error: "spawn failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, run_id: params.id });
}
