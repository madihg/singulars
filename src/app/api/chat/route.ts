/**
 * POST /api/chat - Node serverless route for OpenAI fine-tuned models.
 *
 * Node (NOT edge) + maxDuration=60: the OpenAI fine-tuned nano models can
 * take 30s+ to first token when cold, which exceeded the edge runtime's
 * ~25s cap and produced intermittent 504 FUNCTION_INVOCATION_TIMEOUT errors
 * mid-stream. Node + maxDuration gives the headroom. Logic lives in
 * src/lib/chat-handler.ts (shared with /api/chat-edge).
 *
 * OpenRouter models route to /api/chat-edge instead - the Node lambda can't
 * reach openrouter.ai. The /chat client picks the endpoint by provider.
 */
import { handleChat } from "@/lib/chat-handler";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleChat(req);
}
