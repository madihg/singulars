/**
 * POST /api/chat-edge — edge runtime route for OpenRouter models
 * (reverse.exe / frontière.exe = Claude Opus via OpenRouter).
 *
 * Why a separate edge route: the Vercel NODE lambda cannot reach
 * openrouter.ai (fast APIConnectionError), but the edge runtime can. Claude
 * via OpenRouter is fast, so it never needs Node's long maxDuration. Logic
 * is shared with /api/chat (src/lib/chat-handler.ts). The /chat client
 * routes openrouter-provider models here.
 */
import { handleChat } from "@/lib/chat-handler";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleChat(req);
}
