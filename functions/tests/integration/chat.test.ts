import { describe, it, expect, vi } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";

vi.mock("../../src/services/chatOrchestrator", () => ({
  streamChatResponse: vi.fn(),
}));

import { chatHandler } from "../../src/chat/index";
import { streamChatResponse } from "../../src/services/chatOrchestrator";

function* fixtureStream(chunks: string[]): Generator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function makeRequest(body: unknown, method = "POST"): HttpRequest {
  return {
    method,
    url: "http://localhost:7071/api/chat",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    blob: () => Promise.resolve(new Blob()),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    invocationId: "test-invocation",
    functionName: "chat",
    extraInputs: { get: vi.fn() },
    extraOutputs: { set: vi.fn() },
    options: {},
  } as unknown as InvocationContext;
}

const validBody = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is the transcript.",
  messages: [{ role: "user", content: "What is this about?" }],
  mode: "chat",
};

describe("POST /api/chat — integration", () => {
  it("returns 200 with SSE stream body on valid chat request", async () => {
    (streamChatResponse as ReturnType<typeof vi.fn>).mockReturnValue(
      fixtureStream(["Hello", " world"])
    );

    const req = makeRequest(validBody);
    const response = await chatHandler(req, makeContext());

    expect(response.status).toBe(200);
    expect((response.headers as Record<string, string>)?.["Content-Type"]).toBe("text/event-stream");
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it("returns 400 when videoId is missing", async () => {
    const req = makeRequest({ videoTitle: "T", transcript: "t", messages: [{ role: "user", content: "?" }] });
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(400);
  });

  it("returns 422 when transcript exceeds 80000 chars", async () => {
    const req = makeRequest({
      ...validBody,
      transcript: "x".repeat(80_001),
    });
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(422);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("transcript-too-long");
  });

  it("returns 422 when messages array exceeds 50 items", async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg${i}`,
    }));
    const req = makeRequest({ ...validBody, messages });
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(422);
  });

  it("returns 200 with a stream body even when orchestrator throws (error is in-stream)", async () => {
    (streamChatResponse as ReturnType<typeof vi.fn>).mockImplementation(function* () {
      yield "";
      throw new Error("OpenAI error");
    });

    const req = makeRequest(validBody);
    const response = await chatHandler(req, makeContext());
    // SSE streaming: 200 is sent before stream content; errors propagate as SSE events
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it("handles OPTIONS preflight with 200 and CORS headers", async () => {
    const req = makeRequest({}, "OPTIONS");
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(200);
    expect((response.headers as Record<string, string>)?.["Access-Control-Allow-Origin"]).toBeTruthy();
  });

  it("generates blog post using mode:blog-post fixture", async () => {
    const blogContent = "# My Blog Post\n\nIntroduction paragraph.\n\n## Section 1\n\nContent here.\n\n## Conclusion\n\nWrap up.";
    (streamChatResponse as ReturnType<typeof vi.fn>).mockReturnValue(
      fixtureStream([blogContent])
    );

    const req = makeRequest({ ...validBody, mode: "blog-post" });
    const response = await chatHandler(req, makeContext());
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(ReadableStream);
  });
});
