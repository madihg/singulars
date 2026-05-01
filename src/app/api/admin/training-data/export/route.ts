/**
 * GET /api/admin/training-data/export (US-121)
 *
 * Query params:
 *   format=sft|dpo (required)
 *   performances=slug,slug (optional, defaults to all trained)
 *   exclude_themes=slug,slug
 *   holdout=<slug>
 *   system_prompt=<base64-encoded string> (optional)
 *   preview=true (returns JSON with preview rows + counts; no JSONL stream)
 *
 * Returns either a JSONL stream attachment, or a preview JSON {rows, tokens, preview}.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import {
  buildExport,
  autoFilename,
  DEFAULT_SYSTEM_PROMPT,
  TrainingFormat,
} from "@/lib/training-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") as TrainingFormat | null;
  if (format !== "sft" && format !== "dpo") {
    return NextResponse.json(
      { error: "format must be sft or dpo" },
      { status: 400 },
    );
  }

  const explicitPerfs = url.searchParams.get("performances");
  const excludeRaw = url.searchParams.get("exclude_themes") || "";
  const holdout = url.searchParams.get("holdout") || null;
  const systemPromptB64 = url.searchParams.get("system_prompt");
  const preview = url.searchParams.get("preview") === "true";

  const systemPrompt = systemPromptB64
    ? Buffer.from(systemPromptB64, "base64").toString("utf8")
    : DEFAULT_SYSTEM_PROMPT;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  let perfSlugs: string[];
  if (explicitPerfs) {
    perfSlugs = explicitPerfs.split(",").map((s) => s.trim());
  } else {
    const { data: trained } = await supabase
      .from("performances")
      .select("slug")
      .eq("status", "trained")
      .order("date", { ascending: true });
    perfSlugs = (trained ?? []).map((p) => p.slug as string);
  }

  const result = await buildExport(supabase, {
    format,
    systemPrompt,
    performanceSlugs: perfSlugs,
    excludeThemeSlugs: excludeRaw
      ? excludeRaw.split(",").map((s) => s.trim())
      : [],
    holdoutPerformanceSlug: holdout,
  });

  if (preview) {
    return NextResponse.json({
      rows: result.rows,
      approxTokens: result.approxTokens,
      preview: result.preview,
      holdoutRows: result.holdoutRows ?? 0,
    });
  }

  const filename = autoFilename({
    format,
    nPerfs: perfSlugs.length,
    holdoutSlug: holdout,
  });

  return new Response(result.jsonl, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
