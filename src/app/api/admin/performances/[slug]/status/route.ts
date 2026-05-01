/**
 * POST /api/admin/performances/[slug]/status (US-113, US-103)
 *
 * Body: { status: "upcoming" | "training" | "trained" }
 *
 * Validates the state machine:
 *   upcoming -> training (allowed)
 *   upcoming -> trained  (allowed - cancelled-show case)
 *   training -> trained  (allowed)
 *   trained  -> *        (rejected - cannot un-train)
 *   training -> upcoming (rejected)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

const VALID = ["upcoming", "training", "trained"] as const;
type Status = (typeof VALID)[number];

function isAllowedTransition(from: Status, to: Status): boolean {
  if (from === to) return true;
  if (from === "trained") return false;
  if (from === "training" && to === "upcoming") return false;
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const next = body?.status as Status | undefined;
  if (!next || !VALID.includes(next)) {
    return NextResponse.json(
      { error: `invalid status; expected one of ${VALID.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: perf, error: getErr } = await supabase
    .from("performances")
    .select("id, slug, status, name")
    .eq("slug", params.slug)
    .maybeSingle();
  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!perf) {
    return NextResponse.json(
      { error: "performance not found" },
      { status: 404 },
    );
  }

  const current = perf.status as Status;
  if (!isAllowedTransition(current, next)) {
    return NextResponse.json(
      {
        error: `cannot transition ${current} -> ${next}`,
        hint:
          current === "trained"
            ? "cannot un-train a performance"
            : "invalid transition",
      },
      { status: 400 },
    );
  }

  const { error: updErr } = await supabase
    .from("performances")
    .update({ status: next })
    .eq("slug", params.slug);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  audit({
    audit: "performance.status",
    by: userHashFromRequest(req),
    slug: params.slug,
    name: perf.name,
    old: current,
    new: next,
  });

  return NextResponse.json({ ok: true, slug: params.slug, status: next });
}
