/**
 * POST /api/admin/performances/[slug]/import-csv (US-113, US-104)
 *
 * Multipart upload. CSV columns: theme_slug, human_votes, machine_votes.
 *
 * Body fields:
 *   file: <CSV file>
 *   commitInvalidPartial?: "true" - apply only the valid rows (default: false,
 *     all-or-nothing).
 *
 * Returns: { ok, applied: n, errors: [{ row, theme_slug, message }] }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase";
import { audit, userHashFromRequest } from "@/lib/admin-audit";

type RowError = { row: number; theme_slug: string; message: string };
type ParsedRow = {
  row: number;
  theme_slug: string;
  human_votes: number;
  machine_votes: number;
};

function parseCsv(text: string): { rows: ParsedRow[]; errors: RowError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: [] };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxTheme = header.indexOf("theme_slug");
  const idxHuman = header.indexOf("human_votes");
  const idxMachine = header.indexOf("machine_votes");

  const errors: RowError[] = [];
  if (idxTheme < 0 || idxHuman < 0 || idxMachine < 0) {
    errors.push({
      row: 1,
      theme_slug: "",
      message:
        "header missing required columns: theme_slug, human_votes, machine_votes",
    });
    return { rows: [], errors };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const theme = cols[idxTheme] || "";
    const human = Number(cols[idxHuman]);
    const machine = Number(cols[idxMachine]);
    const lineNum = i + 1;
    if (!theme) {
      errors.push({
        row: lineNum,
        theme_slug: "",
        message: "empty theme_slug",
      });
      continue;
    }
    if (!Number.isFinite(human) || human < 0) {
      errors.push({
        row: lineNum,
        theme_slug: theme,
        message: `invalid human_votes: ${cols[idxHuman]}`,
      });
      continue;
    }
    if (!Number.isFinite(machine) || machine < 0) {
      errors.push({
        row: lineNum,
        theme_slug: theme,
        message: `invalid machine_votes: ${cols[idxMachine]}`,
      });
      continue;
    }
    rows.push({
      row: lineNum,
      theme_slug: theme,
      human_votes: Math.floor(human),
      machine_votes: Math.floor(machine),
    });
  }
  return { rows, errors };
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const denied = requireAuth(req);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart form-data" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  const commitPartial = form.get("commitInvalidPartial") === "true";
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file field missing" }, { status: 400 });
  }

  const text = await (file as File).text();
  const { rows, errors } = parseCsv(text);

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }

  const { data: perf, error: pErr } = await supabase
    .from("performances")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!perf) {
    return NextResponse.json(
      { error: "performance not found" },
      { status: 404 },
    );
  }

  const { data: poems, error: poemErr } = await supabase
    .from("poems")
    .select("id, theme_slug, author_type, vote_count")
    .eq("performance_id", perf.id);
  if (poemErr) {
    return NextResponse.json({ error: poemErr.message }, { status: 500 });
  }

  // Index poems by (theme_slug, author_type).
  const poemIndex = new Map<string, { id: string; vote_count: number }>();
  for (const p of poems ?? []) {
    poemIndex.set(`${p.theme_slug}::${p.author_type}`, {
      id: p.id as string,
      vote_count: (p.vote_count as number) || 0,
    });
  }

  // Validate every row points to existing (theme, author) pair.
  const validatedRows: ParsedRow[] = [];
  for (const r of rows) {
    const human = poemIndex.get(`${r.theme_slug}::human`);
    const machine = poemIndex.get(`${r.theme_slug}::machine`);
    if (!human) {
      errors.push({
        row: r.row,
        theme_slug: r.theme_slug,
        message: "no human poem for this theme in this performance",
      });
      continue;
    }
    if (!machine) {
      errors.push({
        row: r.row,
        theme_slug: r.theme_slug,
        message: "no machine poem for this theme in this performance",
      });
      continue;
    }
    validatedRows.push(r);
  }

  if (errors.length > 0 && !commitPartial) {
    return NextResponse.json(
      { ok: false, applied: 0, errors, would_apply: validatedRows.length },
      { status: 400 },
    );
  }

  // Apply.
  let applied = 0;
  const diffs: Array<{ poem_id: string; old: number; new: number }> = [];
  for (const r of validatedRows) {
    for (const author of ["human", "machine"] as const) {
      const ref = poemIndex.get(`${r.theme_slug}::${author}`)!;
      const next = author === "human" ? r.human_votes : r.machine_votes;
      if (ref.vote_count !== next) {
        const { error: uErr } = await supabase
          .from("poems")
          .update({ vote_count: next })
          .eq("id", ref.id);
        if (uErr) {
          return NextResponse.json({ error: uErr.message }, { status: 500 });
        }
        diffs.push({ poem_id: ref.id, old: ref.vote_count, new: next });
        applied += 1;
      }
    }
  }

  audit({
    audit: "performance.csv_import",
    by: userHashFromRequest(req),
    slug: params.slug,
    name: perf.name,
    rows: rows.length,
    valid: validatedRows.length,
    errors_count: errors.length,
    applied,
    diffs,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    applied,
    errors,
  });
}
