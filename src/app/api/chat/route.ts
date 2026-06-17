/**
 * POST /api/chat - streaming poetry chat.
 *
 * Looks up the requested model in src/lib/models.ts. For provider="openai"
 * (default), calls OpenAI directly with the fine-tuned ft:... model id. For
 * provider="openrouter", routes through OpenRouter (OpenAI-compatible API)
 * - that's how frontière.exe reaches Claude Opus 4.7 with the rich pantheon
 * + 5-pair in-context DPO system prompt.
 */

import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { getModelBySlug, isValidModelSlug } from "@/lib/models";

// Node serverless (NOT edge) + a generous maxDuration. The edge runtime caps
// a request at ~25s, and OpenAI fine-tuned nano models can take longer than
// that to first token when they're cold or under load - which produced
// intermittent 504 FUNCTION_INVOCATION_TIMEOUT errors mid-stream (a poem
// would half-render then die). Node + maxDuration=60 gives ~2.4x the headroom
// and tolerates cold fine-tune latency. Streaming still works on Node.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Cap generation so a runaway response can't eat the whole budget. Poems are
// short; 800 tokens is generous headroom over the ~350-char target.
const MAX_TOKENS = 800;

function getClient(provider: "openai" | "openrouter") {
  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return null;
    return new OpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // Parse + validate the body. A malformed body should never throw an
  // opaque 500 - return a clear 400 instead.
  let messages: unknown;
  let modelSlug: unknown;
  try {
    const body = await req.json();
    messages = body.messages;
    modelSlug = body.modelSlug;
  } catch {
    return jsonError("Invalid request body (expected JSON).", 400);
  }

  if (typeof modelSlug !== "string" || !isValidModelSlug(modelSlug)) {
    return jsonError(
      `Invalid model: ${String(
        modelSlug,
      )}. Valid slugs: carnation-fr, carnation-eng, versus, reinforcement, hard, reverse, frontiere`,
      400,
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("No messages provided.", 400);
  }

  const model = getModelBySlug(modelSlug)!;
  const provider = model.provider ?? "openai";
  const client = getClient(provider);
  if (!client) {
    return jsonError(
      `${provider.toUpperCase()} API key not configured on the server.`,
      503,
    );
  }

  // The provider call is the most failure-prone step (rate limits, model
  // outages, expired fine-tunes, network blips). Without this try/catch an
  // unhandled throw becomes an opaque 500 + a generic "Something went wrong"
  // banner with no detail. Catch it and surface the real reason + the right
  // status so the UI can show something actionable.
  try {
    const response = await client.chat.completions.create({
      model: model.modelId,
      stream: true,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: model.systemPrompt }, ...messages],
    });

    // Type assertion needed: openai@4.x Stream types don't align with ai@2.x
    // expected types at compile time, but runtime behavior is compatible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = OpenAIStream(response as any);
    return new StreamingTextResponse(stream);
  } catch (err: unknown) {
    // OpenAI SDK errors carry .status and .message; fall back gracefully.
    const e = err as { status?: number; message?: string };
    const status = typeof e?.status === "number" ? e.status : 502;
    const detail = e?.message || "Unknown error from the model provider.";
    console.error(
      `Chat generation failed [${modelSlug} via ${provider}] (${status}): ${detail}`,
    );
    const friendly =
      status === 429
        ? "The model is rate-limited right now. Please wait a moment and try again."
        : `The ${model.displayName} model couldn't respond (${provider}: ${detail}). Please try again.`;
    return jsonError(friendly, status === 429 ? 429 : 502);
  }
}
