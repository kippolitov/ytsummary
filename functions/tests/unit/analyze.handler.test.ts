import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";

vi.mock("../../src/services/openaiOrchestrator", () => ({
  orchestrateAnalysis: vi.fn(),
}));
vi.mock("../../src/services/transcriptFetcher", () => ({
  fetchTranscript: vi.fn(),
}));

import { analyzeHandler } from "../../src/analyze/index";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import { fetchTranscript } from "../../src/services/transcriptFetcher";
import type { AnalyzeResponse } from "../../src/models/index";

function makeRequest(body: unknown, method = "POST"): HttpRequest {
  return {
    method,
    url: "http://localhost:7071/api/analyze",
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

const validBody = {
  videoId: "abc12345678",
  title: "Test Video",
  channelName: "Test Channel",
  transcript: "This is the transcript.",
  durationSeconds: 600,
};

const result: AnalyzeResponse = {
  videoId: "abc12345678",
  tldr: ["Takeaway."],
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-06-10T10:00:00Z",
};

describe("analyzeHandler — edge cases", () => {
  beforeEach(() => {
    vi.mocked(orchestrateAnalysis).mockReset();
    vi.mocked(fetchTranscript).mockReset();
  });

  it("answers OPTIONS preflight with 204", async () => {
    const response = await analyzeHandler(makeRequest({}, "OPTIONS"), makeContext());
    expect(response.status).toBe(204);
    expect((response.headers as Record<string, string>)["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const response = await analyzeHandler(makeRequest(new Error("bad json")), makeContext());
    expect(response.status).toBe(400);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("invalid-request");
  });

  it("fetches the transcript server-side when the body has an empty transcript", async () => {
    vi.mocked(fetchTranscript).mockResolvedValue("Fetched transcript text.");
    vi.mocked(orchestrateAnalysis).mockResolvedValue(result);

    const response = await analyzeHandler(
      makeRequest({ ...validBody, transcript: "" }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(fetchTranscript).toHaveBeenCalledWith(validBody.videoId);
    expect(orchestrateAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: "Fetched transcript text." })
    );
  });

  it("returns 422 when no transcript can be fetched", async () => {
    vi.mocked(fetchTranscript).mockResolvedValue(null);

    const response = await analyzeHandler(
      makeRequest({ ...validBody, transcript: "" }),
      makeContext()
    );

    expect(response.status).toBe(422);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("no-transcript");
    expect(orchestrateAnalysis).not.toHaveBeenCalled();
  });

  it("returns 500 when the analysis orchestrator throws", async () => {
    vi.mocked(orchestrateAnalysis).mockRejectedValue(new Error("OpenAI down"));

    const response = await analyzeHandler(makeRequest(validBody), makeContext());
    expect(response.status).toBe(500);
    const body = response.jsonBody as { error: { code: string } };
    expect(body.error.code).toBe("service-error");
  });
});
