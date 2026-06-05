import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { isAnalyzeRequest } from "../models/index";
import { orchestrateAnalysis } from "../services/openaiOrchestrator";

export async function analyzeHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("analyze function triggered");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-request", "Request body must be valid JSON.");
  }

  if (!isAnalyzeRequest(body)) {
    return errorResponse(400, "invalid-request", "Missing or invalid required fields: videoId, title, channelName, transcript, durationSeconds.");
  }

  if (body.transcript.length > 200_000) {
    return errorResponse(422, "transcript-too-long", "Video is too long to analyze in v1.");
  }

  try {
    const result = await orchestrateAnalysis(body);
    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: result,
    };
  } catch (err) {
    context.error("orchestrateAnalysis failed:", err);
    return errorResponse(500, "service-error", "Analysis failed. Please try again.");
  }
}

function errorResponse(status: number, code: string, message: string): HttpResponseInit {
  return {
    status,
    headers: corsHeaders(),
    jsonBody: { error: { code, message } },
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-functions-key",
  };
}

app.http("analyze", {
  methods: ["POST", "OPTIONS"],
  authLevel: "function",
  route: "analyze",
  handler: analyzeHandler,
});
