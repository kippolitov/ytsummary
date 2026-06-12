import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendChatMessage } from "../../services/chatClient";
import type { ChatRequest } from "../../types/chat";

const BASE_REQUEST: ChatRequest = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is a test transcript.",
  messages: [{ role: "user", content: "What is this about?" }],
  mode: "chat",
};

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
}

describe("chatClient — sendChatMessage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Stub WXT env vars
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api/chat");
    vi.stubGlobal("WXT_AZURE_FUNCTION_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("yields delta strings from a valid SSE stream", async () => {
    const body = sseBody([
      'data: {"delta":"Hello"}\n\n',
      'data: {"delta":" world"}\n\n',
      "data: [DONE]\n\n",
    ]);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const gen = sendChatMessage(BASE_REQUEST);
    const chunks: string[] = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("terminates cleanly on [DONE] without extra chunks", async () => {
    const body = sseBody(["data: [DONE]\n\n"]);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const gen = sendChatMessage(BASE_REQUEST);
    const chunks: string[] = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(0);
  });

  it("throws a PanelError on HTTP 429", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate-limited", message: "Too many requests" } }), { status: 429 })
    );

    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("throws a PanelError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code: "network-error" });
  });

  it("truncates transcript to 80000 characters before sending", async () => {
    const body = sseBody(["data: [DONE]\n\n"]);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const longRequest: ChatRequest = {
      ...BASE_REQUEST,
      transcript: "x".repeat(100_000),
    };
    const gen = sendChatMessage(longRequest);
    for await (const _ of gen) { /* drain */ }

    const callBody = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string) as ChatRequest;
    expect(callBody.transcript.length).toBe(80_000);
  });

  it("throws a timeout network-error when the request is aborted", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.mocked(fetch).mockRejectedValue(abortError);

    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({
      code: "network-error",
      message: "The chat request timed out.",
    });
  });

  it("throws a non-retryable service-error when the URL is not configured", async () => {
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "");
    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({
      code: "service-error",
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rewrites an /api/analyze base URL to /api/chat", async () => {
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api/analyze");
    const body = sseBody(["data: [DONE]\n\n"]);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const gen = sendChatMessage(BASE_REQUEST);
    for await (const _ of gen) { /* drain */ }

    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain("/api/chat");
  });

  it("throws a service-error when the response has no body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code: "service-error" });
  });

  it.each([
    [400, "unknown", false],
    [422, "transcript-too-long", false],
    [500, "service-error", true],
  ])("maps HTTP %i to PanelError code %s", async (status, code, retryable) => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code, retryable });
  });

  it("upgrades the error code when the body reports rate-limited", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate-limited" } }), { status: 503 })
    );
    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("tolerates a non-JSON error body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 500 }));
    const gen = sendChatMessage(BASE_REQUEST);
    await expect(gen.next()).rejects.toMatchObject({ code: "service-error" });
  });

  it("skips malformed SSE lines and non-data lines", async () => {
    const body = sseBody([
      "event: ping\n",
      "data: {not-valid-json}\n",
      'data: {"delta":"ok"}\n',
      "data: [DONE]\n\n",
    ]);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const gen = sendChatMessage(BASE_REQUEST);
    const chunks: string[] = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["ok"]);
  });

  it("ends cleanly when the stream closes without a [DONE] marker", async () => {
    const body = sseBody(['data: {"delta":"tail"}\n']);
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const gen = sendChatMessage(BASE_REQUEST);
    const chunks: string[] = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["tail"]);
  });
});
