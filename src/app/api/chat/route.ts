import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { getModelBySlug, isValidModelSlug } from "@/lib/models";

export const runtime = "edge";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await req.json();
  const { messages, modelSlug } = body;

  if (!modelSlug || !isValidModelSlug(modelSlug)) {
    return new Response(
      JSON.stringify({
        error: `Invalid model: ${modelSlug}. Valid slugs: carnation-fr, carnation-eng, versus, reinforcement, hard`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const model = getModelBySlug(modelSlug)!;

  const response = await openai.chat.completions.create({
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
