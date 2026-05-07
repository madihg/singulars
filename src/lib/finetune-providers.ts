/**
 * Fine-tune provider wrappers (US-122, US-123, US-124).
 *
 * Each provider exposes:
 *   uploadFile(jsonl, filename) -> { fileId }
 *   startJob(opts) -> { jobId }
 *   pollJob(jobId) -> { status, output_model_id?, error? }
 *
 * The shape is a small adapter so the admin code can stay provider-agnostic.
 * OpenAI is fully wired (their API is the most stable). Together is wired
 * with the documented endpoints; HuggingFace AutoTrain is not yet (returns a
 * "not implemented" error so the form correctly disables it).
 */

export type FinetuneProvider = "openai" | "together" | "huggingface";
export type FinetuneFormat = "sft" | "dpo";

export type StartJobInput = {
  fileId: string;
  baseModel: string;
  format: FinetuneFormat;
  hyperparameters: Record<string, unknown>;
  candidateName: string;
};

export type ProviderStatus = {
  status:
    | "queued"
    | "validating"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  output_model_id?: string;
  error?: string;
  cost_usd?: number;
};

export interface ProviderClient {
  hasKey(): boolean;
  uploadFile(jsonl: string, filename: string): Promise<{ fileId: string }>;
  startJob(input: StartJobInput): Promise<{ jobId: string }>;
  pollJob(jobId: string): Promise<ProviderStatus>;
  promptfooEndpoint(outputModelId: string): string;
}

// ----------------------- OpenAI -----------------------

const openaiClient: ProviderClient = {
  hasKey: () => !!process.env.OPENAI_API_KEY,

  async uploadFile(jsonl, filename) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("missing OPENAI_API_KEY");
    const form = new FormData();
    form.append("purpose", "fine-tune");
    form.append(
      "file",
      new Blob([jsonl], { type: "application/jsonl" }),
      filename,
    );
    const res = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(
        `openai upload failed: ${res.status} ${await res.text()}`,
      );
    }
    const j = await res.json();
    return { fileId: j.id };
  },

  async startJob({ fileId, baseModel, format, hyperparameters }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("missing OPENAI_API_KEY");
    // OpenAI DPO requires hyperparameters NESTED under method.dpo, not at the
    // top level. SFT (legacy) uses top-level hyperparameters. Sending both
    // results in 'top level hyperparameters are not allowed with method dpo'.
    const body: Record<string, unknown> = {
      model: baseModel,
      training_file: fileId,
    };
    if (format === "dpo") {
      body.method = { type: "dpo", dpo: { hyperparameters } };
    } else {
      body.hyperparameters = hyperparameters;
    }
    const res = await fetch(
      "https://api.openai.com/v1/fine_tuning/jobs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(
        `openai job start failed: ${res.status} ${await res.text()}`,
      );
    }
    const j = await res.json();
    return { jobId: j.id };
  },

  async pollJob(jobId) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("missing OPENAI_API_KEY");
    const res = await fetch(
      `https://api.openai.com/v1/fine_tuning/jobs/${jobId}`,
      {
        headers: { Authorization: `Bearer ${key}` },
      },
    );
    if (!res.ok) throw new Error(`openai poll failed: ${res.status}`);
    const j = await res.json();
    return mapOpenAIStatus(j);
  },

  promptfooEndpoint(outputModelId) {
    return `openai:chat:${outputModelId}`;
  },
};

function mapOpenAIStatus(payload: Record<string, unknown>): ProviderStatus {
  const s = payload.status as string;
  const map: Record<string, ProviderStatus["status"]> = {
    validating_files: "validating",
    queued: "queued",
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    cancelled: "cancelled",
  };
  return {
    status: map[s] || "running",
    output_model_id: (payload.fine_tuned_model as string) || undefined,
    error: (payload.error as { message?: string })?.message || undefined,
    cost_usd:
      typeof payload.estimated_finish === "number" ? undefined : undefined,
  };
}

// ----------------------- Together AI -----------------------

const togetherClient: ProviderClient = {
  hasKey: () => !!process.env.TOGETHER_API_KEY,

  async uploadFile(jsonl, filename) {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) throw new Error("missing TOGETHER_API_KEY");
    // Together uses a two-step upload:
    //   1. POST /v1/files with multipart metadata (purpose, file_name, optional
    //      empty file blob) -> 302 redirect with Location header set to a
    //      presigned R2 URL, plus x-together-file-id with the file id
    //   2. PUT the binary content to that R2 URL (no auth header - the URL is
    //      already signed)
    const form = new FormData();
    form.append("purpose", "fine-tune");
    form.append("file_name", filename);
    form.append(
      "file",
      new Blob([jsonl], { type: "application/jsonl" }),
      filename,
    );
    const initRes = await fetch("https://api.together.xyz/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      redirect: "manual",
    });
    if (initRes.status !== 302) {
      throw new Error(
        `together init upload: ${initRes.status} ${await initRes.text()}`,
      );
    }
    const uploadUrl = initRes.headers.get("location");
    const fileId = initRes.headers.get("x-together-file-id");
    if (!uploadUrl || !fileId) {
      throw new Error(
        "together init upload missing Location or x-together-file-id header",
      );
    }
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: jsonl,
    });
    if (!putRes.ok) {
      throw new Error(
        `together r2 PUT: ${putRes.status} ${await putRes.text()}`,
      );
    }
    return { fileId };
  },

  async startJob({ fileId, baseModel, format, hyperparameters }) {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) throw new Error("missing TOGETHER_API_KEY");
    // Together's fine-tune API expects FLATTENED hyperparameters at top level,
    // not nested under a "hyperparameters" key (unlike OpenAI). Sending nested
    // produces "Internal error: finetune" with no helpful message.
    const hp = hyperparameters as Record<string, unknown>;
    const body: Record<string, unknown> = {
      training_file: fileId,
      model: baseModel,
      training_method: format === "dpo" ? "dpo" : "sft",
      n_epochs: hp.n_epochs ?? 3,
      learning_rate:
        hp.learning_rate ??
        (typeof hp.learning_rate_multiplier === "number"
          ? hp.learning_rate_multiplier * 1e-5
          : 1e-5),
    };
    if (format === "dpo" && typeof hp.dpo_beta === "number") {
      body.dpo_beta = hp.dpo_beta;
    }
    if (typeof hp.batch_size !== "undefined") {
      body.batch_size = hp.batch_size;
    }
    const res = await fetch("https://api.together.xyz/v1/fine-tunes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`together job start: ${await res.text()}`);
    const j = await res.json();
    return { jobId: j.id };
  },

  async pollJob(jobId) {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) throw new Error("missing TOGETHER_API_KEY");
    const res = await fetch(`https://api.together.xyz/v1/fine-tunes/${jobId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`together poll: ${res.status}`);
    const j = await res.json();
    const s = (j.status as string) || "running";
    const status: ProviderStatus["status"] =
      s === "completed"
        ? "succeeded"
        : s === "failed"
          ? "failed"
          : s === "cancelled"
            ? "cancelled"
            : "running";
    return {
      status,
      output_model_id: (j.output_name as string) || undefined,
      error: (j.error as string) || undefined,
    };
  },

  promptfooEndpoint(outputModelId) {
    return `together:fine-tunes:${outputModelId}`;
  },
};

// ----------------------- HuggingFace AutoTrain (stub) -----------------------

const huggingfaceClient: ProviderClient = {
  hasKey: () => !!process.env.HUGGINGFACE_API_KEY,
  async uploadFile() {
    throw new Error(
      "huggingface autotrain not yet wired - upload via hf hub directly",
    );
  },
  async startJob() {
    throw new Error("huggingface autotrain not yet wired");
  },
  async pollJob() {
    throw new Error("huggingface autotrain not yet wired");
  },
  promptfooEndpoint(outputModelId) {
    return `huggingface:${outputModelId}`;
  },
};

export function getProviderClient(p: FinetuneProvider): ProviderClient {
  if (p === "openai") return openaiClient;
  if (p === "together") return togetherClient;
  if (p === "huggingface") return huggingfaceClient;
  throw new Error(`unsupported provider ${p}`);
}

export const PROVIDER_BASE_MODELS: Record<FinetuneProvider, string[]> = {
  openai: [
    "gpt-4o-mini-2024-07-18",
    "gpt-4.1-2025-04-14",
    "gpt-3.5-turbo-1106",
  ],
  together: [
    "meta-llama/Llama-3.3-70B-Instruct",
    "Qwen/Qwen3-14B",
    "mistralai/Mistral-Nemo-Instruct-2407",
  ],
  huggingface: ["meta-llama/Llama-3.2-3B-Instruct"],
};

export const PROVIDER_SUPPORTS_DPO: Record<FinetuneProvider, boolean> = {
  openai: true,
  together: true,
  huggingface: false,
};
