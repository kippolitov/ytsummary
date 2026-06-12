import { describe, it, expect, vi } from "vitest";
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

vi.mock("../../src/services/chatOrchestrator", () => ({
  streamChatResponse: vi.fn(),
  generateFollowUpPrompts: vi.fn(),
}));

import { chatHandler } from "../../src/chat/index";
import { streamChatResponse, generateFollowUpPrompts } from "../../src/services/chatOrchestrator";

function makeRequest(body: unknown, method = "POST"): HttpRequest {
  return {
    method,
    url: "http://localhost:7071/api/chat",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () =>
      body instanceof Error ? Promise.reject(body) : Promise.resolve(body),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as InvocationContext;
}

async function readStream(response: HttpResponseInit): Promise<string> {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

const validBody = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is the transcript.",
  messages: [{ role: "user", content: "What is this about?" }],
  mode: "chat",
};

const followUpBody = {
  ...validBody,
  mode: "follow-up-prompts",
  messages: [
    { role: "user", content: "What is this about?" },
    { role: "assistant", content: "It is about testing." },
  ],
};

describe("chatHandler — edge cases", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const req = makeRequest(new Error("Unexpected token"));
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(400);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("bad-request");
  });

  it("returns follow-up prompts as JSON for follow-up-prompts mode", async () => {
    vi.mocked(generateFollowUpPrompts).mockResolvedValue(["Q1?", "Q2?", "Q3?"]);

    const response = await chatHandler(makeRequest(followUpBody), makeContext());
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ prompts: ["Q1?", "Q2?", "Q3?"] });
    expect((response.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("returns 500 when follow-up prompt generation fails", async () => {
    vi.mocked(generateFollowUpPrompts).mockRejectedValue(new Error("model error"));

    const response = await chatHandler(makeRequest(followUpBody), makeContext());
    expect(response.status).toBe(500);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("service-error");
  });

  it("encodes stream deltas as SSE and terminates with [DONE]", async () => {
    vi.mocked(streamChatResponse).mockImplementation(async function* () {
      await Promise.resolve();
      yield "Hello";
      yield " world";
    });

    const response = await chatHandler(makeRequest(validBody), makeContext());
    const text = await readStream(response);
    expect(text).toContain('data: {"delta":"Hello"}');
    expect(text).toContain('data: {"delta":" world"}');
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("emits an in-stream error event when the generator throws mid-stream", async () => {
    vi.mocked(streamChatResponse).mockImplementation(async function* () {
      await Promise.resolve();
      yield "partial";
      throw new Error("upstream failure");
    });

    const response = await chatHandler(makeRequest(validBody), makeContext());
    const text = await readStream(response);
    expect(text).toContain('data: {"delta":"partial"}');
    expect(text).toContain('data: {"error":"stream-error"}');
    expect(text).not.toContain("[DONE]");
  });

  it("returns 500 when the orchestrator throws synchronously", async () => {
    vi.mocked(streamChatResponse).mockImplementation(() => {
      throw new Error("setup failure");
    });

    const response = await chatHandler(makeRequest(validBody), makeContext());
    expect(response.status).toBe(500);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("service-error");
  });
});
