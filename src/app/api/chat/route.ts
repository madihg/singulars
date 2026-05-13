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

export const runtime = "edge";

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

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, modelSlug } = body;

  if (!modelSlug || !isValidModelSlug(modelSlug)) {
    return new Response(
      JSON.stringify({
        error: `Invalid model: ${modelSlug}. Valid slugs: carnation-fr, carnation-eng, versus, reinforcement, hard, reverse`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const model = getModelBySlug(modelSlug)!;
  const provider = model.provider ?? "openai";
  const client = getClient(provider);
  if (!client) {
    return new Response(
      JSON.stringify({
        error: `${provider.toUpperCase()} API key not configured`,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const response = await client.chat.completions.create({
    model: model.modelId,
    stream: true,
    messages: [{ role: "system", content: model.systemPrompt }, ...messages],
  });

  // Type assertion needed: openai@4.x Stream types don't align with ai@2.x
  // expected types at compile time, but runtime behavior is compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = OpenAIStream(response as any);
  return new StreamingTextResponse(stream);
}
