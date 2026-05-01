/**
 * scripts/run-finetune.ts (US-124 CLI parity)
 *
 * Usage:
 *   npm run finetune -- --provider openai --base gpt-4o-mini-2024-07-18 \
 *     --format dpo --performances carnation-exe,versus-exe --holdout reverse-exe \
 *     --name "ground.exe (v2)"
 *
 * Mirrors the /admin/fine-tunes/new form: pulls golden tuples from Supabase,
 * builds JSONL via lib/training-data, calls the provider client, inserts the
 * fine_tune_jobs row.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildExport, DEFAULT_SYSTEM_PROMPT } from "../src/lib/training-data";
import {
  getProviderClient,
  FinetuneProvider,
  PROVIDER_SUPPORTS_DPO,
} from "../src/lib/finetune-providers";

type Args = {
  provider?: FinetuneProvider;
  base?: string;
  format?: "sft" | "dpo";
  performances?: string[];
  holdout?: string | null;
  name?: string;
  systemPrompt?: string;
  epochs?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider") args.provider = argv[++i] as FinetuneProvider;
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--format") args.format = argv[++i] as "sft" | "dpo";
    else if (a === "--performances")
      args.performances = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--holdout") args.holdout = argv[++i];
    else if (a === "--name") args.name = argv[++i];
    else if (a === "--system-prompt") args.systemPrompt = argv[++i];
    else if (a === "--epochs") args.epochs = Number(argv[++i]);
  }
  return args;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (
    !args.provider ||
    !args.base ||
    !args.format ||
    !args.performances ||
    !args.name
  ) {
    process.stderr.write(
      "usage: run-finetune --provider <openai|together> --base <model> --format <sft|dpo> --performances <slug,slug> [--holdout <slug>] --name <candidate name>\n",
    );
    process.exit(1);
  }
  if (args.format === "dpo" && !PROVIDER_SUPPORTS_DPO[args.provider]) {
    process.stderr.write(`${args.provider} does not support DPO\n`);
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    process.stderr.write(
      "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n",
    );
    process.exit(1);
  }
  // Cast: SupabaseClient generic defaults to "public" schema; the singulars
  // schema is set via db.schema option but TypeScript can't infer the swap.
  const supabase = createClient(url, key, {
    db: { schema: "singulars" },
  }) as unknown as SupabaseClient;

  const client = getProviderClient(args.provider);
  if (!client.hasKey()) {
    process.stderr.write(
      `missing ${args.provider.toUpperCase()}_API_KEY - set in .env.local\n`,
    );
    process.exit(1);
  }

  // Resolve perf ids
  const { data: perfs } = await supabase
    .from("performances")
    .select("id, slug")
    .in("slug", args.performances);
  const sourceIds = (perfs ?? []).map((p) => p.id as string);

  let holdoutIds: string[] = [];
  if (args.holdout) {
    const { data: hp } = await supabase
      .from("performances")
      .select("id")
      .eq("slug", args.holdout)
      .maybeSingle();
    if (hp) holdoutIds = [hp.id as string];
  }

  const exportResult = await buildExport(supabase, {
    format: args.format,
    systemPrompt: args.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    performanceSlugs: args.performances,
    holdoutPerformanceSlug: args.holdout || null,
  });
  if (exportResult.rows === 0) {
    process.stderr.write("no training rows after holdout / exclusions\n");
    process.exit(1);
  }
  process.stdout.write(
    `built ${exportResult.rows} rows (${exportResult.approxTokens} tokens)\n`,
  );

  const upload = await client.uploadFile(
    exportResult.jsonl,
    `singulars-cli-${args.format}-${Date.now()}.jsonl`,
  );
  process.stdout.write(`uploaded ${upload.fileId}\n`);

  const start = await client.startJob({
    fileId: upload.fileId,
    baseModel: args.base,
    format: args.format,
    hyperparameters: { n_epochs: args.epochs || 3 },
    candidateName: args.name,
  });
  process.stdout.write(`job started: ${start.jobId}\n`);

  // Pre-create candidate_models row
  const { data: candidateRow } = await supabase
    .from("candidate_models")
    .insert({
      name: args.name,
      slug: slugify(args.name),
      family:
        args.provider === "openai"
          ? "gpt"
          : args.provider === "together"
            ? "llama"
            : "other",
      color: "#888",
      is_public: false,
      archived: false,
      notes: `auto-registered fine-tune via ${args.provider} (cli)`,
    })
    .select()
    .single();

  const { data: row, error } = await supabase
    .from("fine_tune_jobs")
    .insert({
      provider: args.provider,
      base_model: args.base,
      training_format: args.format,
      system_prompt: args.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      source_performance_ids: sourceIds,
      holdout_performance_ids: holdoutIds,
      n_training_rows: exportResult.rows,
      hyperparameters: { n_epochs: args.epochs || 3 },
      provider_job_id: start.jobId,
      provider_file_id: upload.fileId,
      status: "queued",
      auto_registered_candidate_id: candidateRow?.id,
      triggered_by_user: "cli",
      training_data_snapshot: {
        rows: exportResult.rows,
        approx_tokens: exportResult.approxTokens,
      },
    })
    .select()
    .single();
  if (error) {
    process.stderr.write(`db insert failed: ${error.message}\n`);
    process.exit(1);
  }

  process.stdout.write(`fine_tune_jobs row: ${row?.id}\n`);
  process.stdout.write(`monitor: /admin/fine-tunes/${row?.id}\n`);
}

main().catch((e) => {
  process.stderr.write(`crashed: ${e?.stack || e?.message || e}\n`);
  process.exit(1);
});
