import { describe, it, expect, vi } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";

// We mock the orchestrator to use recorded/fixture responses rather than hitting real OpenAI
vi.mock("../../src/services/openaiOrchestrator", () => ({
  orchestrateAnalysis: vi.fn(),
}));

vi.mock("../../src/services/transcriptFetcher", () => ({
  fetchTranscript: vi.fn(),
}));

import { analyzeHandler } from "../../src/analyze/index";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import { fetchTranscript } from "../../src/services/transcriptFetcher";

const fixtureResult = {
  videoId: "abc12345678",
  summary: "A recorded fixture summary for the test.",
  topics: [{ name: "DI", description: "Dependency injection overview.", timestampSeconds: 30 }],
  steps: [],
  references: [],
  analyzedAt: "2026-06-05T12:00:00Z",
};

function makeRequest(body: unknown, method = "POST"): HttpRequest {
  return {
    method,
    url: "http://localhost:7071/api/analyze",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    blob: async () => new Blob(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    invocationId: "test-invocation",
    functionName: "analyze",
    extraInputs: { get: vi.fn() },
    extraOutputs: { set: vi.fn() },
    options: {},
  } as unknown as InvocationContext;
}

describe("POST /api/analyze — integration", () => {
  it("happy path returns 200 with AnalyzeResponse fixture", async () => {
    (orchestrateAnalysis as ReturnType<typeof vi.fn>).mockResolvedValue(fixtureResult);

    const req = makeRequest({
      videoId: "abc12345678",
      title: "Test video",
      channelName: "TestChannel",
      transcript: "This is the transcript content.",
      durationSeconds: 600,
    });

    const response = await analyzeHandler(req, makeContext());
    expect(response.status).toBe(200);
    const body = response.jsonBody as typeof fixtureResult;
    expect(body.summary).toBe(fixtureResult.summary);
    expect(body.videoId).toBe("abc12345678");
  });

  it("returns 400 when videoId is missing", async () => {
    const req = makeRequest({
      title: "No ID",
      channelName: "Chan",
      transcript: "Some text",
      durationSeconds: 60,
    });

    const response = await analyzeHandler(req, makeContext());
    expect(response.status).toBe(400);
  });

  it("fetches transcript from YouTube when transcript is empty and succeeds", async () => {
    (fetchTranscript as ReturnType<typeof vi.fn>).mockResolvedValue("Fetched transcript text.");
    (orchestrateAnalysis as ReturnType<typeof vi.fn>).mockResolvedValue(fixtureResult);

    const req = makeRequest({
      videoId: "abc12345678",
      title: "Title",
      channelName: "Chan",
      transcript: "",
      durationSeconds: 60,
    });

    const response = await analyzeHandler(req, makeContext());
    expect(response.status).toBe(200);
  });

  it("returns 422 when transcript is empty and YouTube fetch also fails", async () => {
    (fetchTranscript as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = makeRequest({
      videoId: "abc12345678",
      title: "Title",
      channelName: "Chan",
      transcript: "",
      durationSeconds: 60,
    });

    const response = await analyzeHandler(req, makeContext());
    expect(response.status).toBe(422);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("no-transcript");
  });

  it("returns 422 when transcript exceeds 200000 chars", async () => {
    const req = makeRequest({
      videoId: "abc12345678",
      title: "Title",
      channelName: "Chan",
      transcript: "x".repeat(200001),
      durationSeconds: 60,
    });

    const response = await analyzeHandler(req, makeContext());
    expect(response.status).toBe(422);
  });
});
