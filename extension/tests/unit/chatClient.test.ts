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
});
