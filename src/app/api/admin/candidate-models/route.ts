/**
 * /api/admin/candidate-models (US-114)
 *
 * GET  - list all rows. ?include_archived=true returns archived too. ?slug=foo
 *        returns just the row matching that slug (used for slug-conflict checks
 *        in the new-model form).
 * POST - create a candidate model. Body fields match the candidate_models
 *        columns. Validates slug uniqueness explicitly so the form can show a
 *        clean error.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

const FAMILY_VALUES = [
  "claude",
  "gpt",
  "gemini",
  "grok",
  "deepseek",
  "qwen",
  "llama",
  "mistral",
  "open-source-ground",
  "other",
] as const;
type Family = (typeof FAMILY_VALUES)[number];

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const slug = url.searchParams.get("slug");

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  let query = supabase
    .from("candidate_models")
    .select(
      "id, name, slug, family, version_label, fine_tune_source, api_endpoint, hf_repo, color, notes, is_public, archived, created_at, updated_at",
    )
    .order("name", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);
  if (slug) query = query.eq("slug", slug);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ models: data ?? [] });
}

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const required = ["name", "slug", "family"] as const;
  for (const k of required) {
    if (!body[k] || typeof body[k] !== "string") {
      return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    }
  }
  if (!FAMILY_VALUES.includes(body.family as Family)) {
    return NextResponse.json(
      { error: `family must be one of ${FAMILY_VALUES.join(", ")}` },
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

  // Slug conflict check
  const { data: existing } = await supabase
    .from("candidate_models")
    .select("id, name")
    .eq("slug", body.slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `slug taken by ${existing.name}` },
      { status: 409 },
    );
  }

  const insert = {
    name: body.name,
    slug: body.slug,
    family: body.family,
    version_label: body.version_label ?? null,
    fine_tune_source: body.fine_tune_source ?? null,
    api_endpoint: body.api_endpoint ?? null,
    hf_repo: body.hf_repo ?? null,
    color: body.color ?? "#888",
    notes: body.notes ?? null,
    is_public: body.is_public === true,
    archived: false,
  };
  const { data, error } = await supabase
    .from("candidate_models")
    .insert(insert)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  audit({
    audit: "candidate_model.create",
    by: userHashFromRequest(req),
    id: data.id,
    slug: data.slug,
    name: data.name,
  });

  return NextResponse.json({ model: data });
}
