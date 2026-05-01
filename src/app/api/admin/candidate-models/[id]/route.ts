/**
 * /api/admin/candidate-models/[id] (US-114)
 *
 * GET    - read one
 * PUT    - update fields
 * DELETE - soft-delete (archived = true)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

const EDITABLE = [
  "name",
  "slug",
  "family",
  "version_label",
  "fine_tune_source",
  "api_endpoint",
  "hf_repo",
  "color",
  "notes",
  "is_public",
  "archived",
] as const;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("candidate_models")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ model: data });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "no editable fields in body" },
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

  // Slug conflict check on update
  if (typeof update.slug === "string") {
    const { data: collision } = await supabase
      .from("candidate_models")
      .select("id, name")
      .eq("slug", update.slug)
      .neq("id", params.id)
      .maybeSingle();
    if (collision) {
      return NextResponse.json(
        { error: `slug taken by ${collision.name}` },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabase
    .from("candidate_models")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  audit({
    audit: "candidate_model.update",
    by: userHashFromRequest(req),
    id: params.id,
    fields: Object.keys(update),
  });

  return NextResponse.json({ model: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("candidate_models")
    .update({ archived: true })
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  audit({
    audit: "candidate_model.archive",
    by: userHashFromRequest(req),
    id: params.id,
  });

  return NextResponse.json({ model: data });
}
