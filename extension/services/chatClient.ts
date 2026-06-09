import type { ChatRequest, ChatStreamChunk } from "../types/chat";
import type { PanelError, ErrorCode } from "../types/index";

declare const WXT_AZURE_FUNCTION_URL: string;
declare const WXT_AZURE_FUNCTION_KEY: string;

const MAX_TRANSCRIPT_CHARS = 80_000;
const TIMEOUT_MS = 65_000;

export async function* sendChatMessage(req: ChatRequest): AsyncGenerator<string> {
  const truncatedReq: ChatRequest =
    req.transcript.length > MAX_TRANSCRIPT_CHARS
      ? { ...req, transcript: req.transcript.slice(0, MAX_TRANSCRIPT_CHARS) }
      : req;

  const chatUrl = buildChatUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(truncatedReq),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw makePanelError("network-error", "The chat request timed out.", "Check your connection and try again.", true);
    }
    throw makePanelError("network-error", "Could not reach the chat service.", "Check your internet connection and try again.", true);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw await mapHttpError(response);
  }

  const body = response.body;
  if (!body) {
    throw makePanelError("service-error", "The chat service returned an empty response.", "Try again.", true);
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as ChatStreamChunk;
          if (chunk.delta) yield chunk.delta;
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function buildChatUrl(): string {
  if (!WXT_AZURE_FUNCTION_URL) {
    throw makePanelError("service-error", "The chat service is not configured.", "Please reinstall the extension.", false);
  }
  const base = WXT_AZURE_FUNCTION_URL.replace(/\/api\/analyze$/, "/api/chat");
  const url = new URL(base);
  if (WXT_AZURE_FUNCTION_KEY) {
    url.searchParams.set("code", WXT_AZURE_FUNCTION_KEY);
  }
  return url.toString();
}

async function mapHttpError(response: Response): Promise<PanelError> {
  let code: ErrorCode = "service-error";
  let message = "The chat service encountered an error.";
  let action = "Try again.";
  let retryable = true;

  if (response.status === 400 || response.status === 422) {
    code = response.status === 422 ? "transcript-too-long" : "unknown";
    message = "The chat request was invalid.";
    action = "Try again with a shorter message or different video.";
    retryable = false;
  } else if (response.status === 429) {
    code = "rate-limited";
    message = "The service is temporarily busy.";
    action = "Try again in a moment.";
  } else if (response.status >= 500) {
    code = "service-error";
  }

  try {
    const errBody = await response.json() as { error?: { code?: string; message?: string } };
    if (errBody.error?.code === "rate-limited") code = "rate-limited";
  } catch {
    // ignore JSON parse errors
  }

  return makePanelError(code, message, action, retryable);
}

function makePanelError(code: ErrorCode, message: string, action: string, retryable: boolean): PanelError {
  return { code, message, action, retryable };
}
