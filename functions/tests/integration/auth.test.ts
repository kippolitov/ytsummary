import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import {
  startAzuriteTable,
  stopAzuriteTable,
  tableStorageConnectionString,
} from "./tableStorageTestHelper";
import { startGoogleCertsStub, stopGoogleCertsStub, signTestIdToken } from "./googleJwksTestHelper";

vi.mock("../../src/services/openaiOrchestrator", () => ({
  orchestrateAnalysis: vi.fn(),
}));
vi.mock("../../src/services/transcriptFetcher", () => ({
  fetchTranscript: vi.fn(),
}));
vi.mock("../../src/services/chatOrchestrator", () => ({
  streamChatResponse: vi.fn(),
  generateFollowUpPrompts: vi.fn(),
}));

import { analyzeHandler } from "../../src/analyze/index";
import { chatHandler } from "../../src/chat/index";
import { withAuth } from "../../src/services/auth";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import { streamChatResponse } from "../../src/services/chatOrchestrator";

const AUD = "test-client-id";
const ALLOWED_EMAIL = "allowed@example.com";

function makeRequest(url: string, body: unknown, headers: Record<string, string> = {}): HttpRequest {
  return {
    method: "POST",
    url,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;
}

const validAnalyzeBody = {
  videoId: "abc12345678",
  title: "Test video",
  channelName: "Chan",
  transcript: "Transcript text.",
  durationSeconds: 100,
};

const validChatBody = {
  videoId: "abc12345678",
  videoTitle: "Test video",
  transcript: "Transcript text.",
  messages: [{ role: "user", content: "Summarize this." }],
};

const analyzeResult = {
  videoId: "abc12345678",
  tldr: ["A takeaway."],
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-01-01T00:00:00Z",
};

describe("Auth enforcement on analyze/chat — integration", () => {
  beforeAll(async () => {
    await startAzuriteTable();
    process.env.AzureWebJobsStorage = tableStorageConnectionString();

    const certsUrl = await startGoogleCertsStub();
    process.env.GOOGLE_OAUTH_CERTS_URL = certsUrl;
    process.env.GOOGLE_OAUTH_CLIENT_ID = AUD;

    const table = TableClient.fromConnectionString(tableStorageConnectionString(), "AllowedUsers", {
      allowInsecureConnection: true,
    });
    await table.createTable();
    await table.createEntity({ partitionKey: "AllowedUser", rowKey: ALLOWED_EMAIL });
  }, 30_000);

  afterAll(async () => {
    await stopGoogleCertsStub();
    await stopAzuriteTable();
  });

  it("analyze rejects a request with no Authorization header before calling OpenAI", async () => {
    const response = await withAuth(analyzeHandler)(
      makeRequest("http://localhost:7071/api/analyze", validAnalyzeBody),
      makeContext()
    );
    expect(response.status).toBe(401);
    expect(orchestrateAnalysis).not.toHaveBeenCalled();
  });

  it("analyze rejects an invalid/malformed bearer token", async () => {
    const response = await withAuth(analyzeHandler)(
      makeRequest("http://localhost:7071/api/analyze", validAnalyzeBody, {
        authorization: "Bearer not-a-real-jwt",
      }),
      makeContext()
    );
    expect(response.status).toBe(401);
    expect(orchestrateAnalysis).not.toHaveBeenCalled();
  });

  it("analyze rejects a valid, verifiable token for an account not on AllowedUsers", async () => {
    const idToken = signTestIdToken({ sub: "s1", email: "stranger@example.com", audience: AUD });
    const response = await withAuth(analyzeHandler)(
      makeRequest("http://localhost:7071/api/analyze", validAnalyzeBody, {
        authorization: `Bearer ${idToken}`,
      }),
      makeContext()
    );
    expect(response.status).toBe(403);
    expect(orchestrateAnalysis).not.toHaveBeenCalled();
  });

  it("analyze accepts a valid, verifiable token for an authorized account", async () => {
    vi.mocked(orchestrateAnalysis).mockResolvedValue(analyzeResult);
    const idToken = signTestIdToken({ sub: "s2", email: ALLOWED_EMAIL, audience: AUD });

    const response = await withAuth(analyzeHandler)(
      makeRequest("http://localhost:7071/api/analyze", validAnalyzeBody, {
        authorization: `Bearer ${idToken}`,
      }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(orchestrateAnalysis).toHaveBeenCalled();
  });

  it("chat rejects a request with no Authorization header before streaming", async () => {
    const response = await withAuth(chatHandler)(
      makeRequest("http://localhost:7071/api/chat", validChatBody),
      makeContext()
    );
    expect(response.status).toBe(401);
    expect(streamChatResponse).not.toHaveBeenCalled();
  });

  it("chat rejects a valid token for an account not on AllowedUsers", async () => {
    const idToken = signTestIdToken({ sub: "s3", email: "stranger2@example.com", audience: AUD });
    const response = await withAuth(chatHandler)(
      makeRequest("http://localhost:7071/api/chat", validChatBody, {
        authorization: `Bearer ${idToken}`,
      }),
      makeContext()
    );
    expect(response.status).toBe(403);
    expect(streamChatResponse).not.toHaveBeenCalled();
  });

  it("chat accepts a valid token for an authorized account", async () => {
    vi.mocked(streamChatResponse).mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield "Hello";
      })()
    );
    const idToken = signTestIdToken({ sub: "s4", email: ALLOWED_EMAIL, audience: AUD });

    const response = await withAuth(chatHandler)(
      makeRequest("http://localhost:7071/api/chat", validChatBody, {
        authorization: `Bearer ${idToken}`,
      }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(streamChatResponse).toHaveBeenCalled();
  });
});
