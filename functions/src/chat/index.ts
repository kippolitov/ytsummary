import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { isChatRequest } from "../models/index";
import { streamChatResponse } from "../services/chatOrchestrator";

const MAX_TRANSCRIPT_CHARS = 80_000;
const MAX_MESSAGES = 50;

export async function chatHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 200, headers: corsHeaders() };
  }

  context.log("chat function triggered");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad-request", "Request body must be valid JSON.");
  }

  if (!isChatRequest(body)) {
    return errorResponse(400, "bad-request", "Missing or invalid required fields: videoId, videoTitle, transcript, messages.");
  }

  if (body.transcript.length > MAX_TRANSCRIPT_CHARS) {
    return errorResponse(422, "transcript-too-long", `Transcript exceeds the ${MAX_TRANSCRIPT_CHARS} character limit.`);
  }

  if (body.messages.length > MAX_MESSAGES) {
    return errorResponse(422, "too-many-messages", `messages array exceeds the ${MAX_MESSAGES} item limit.`);
  }

  try {
    const generator = streamChatResponse(body);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of generator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          context.error("streamChatResponse failed:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "stream-error" })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return {
      status: 200,
      body: stream,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    };
  } catch (err) {
    context.error("chatHandler failed:", err);
    return errorResponse(500, "service-error", "Chat failed. Please try again.");
  }
}

function errorResponse(status: number, code: string, message: string): HttpResponseInit {
  return {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    jsonBody: { error: { code, message } },
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-functions-key",
  };
}

app.http("chat", {
  methods: ["POST"],
  authLevel: "function",
  route: "chat",
  handler: chatHandler,
});

app.http("chat-preflight", {
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  route: "chat",
  handler: async () => ({ status: 204, headers: corsHeaders() }),
});
