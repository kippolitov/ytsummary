import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import {
  startAzuriteTable,
  stopAzuriteTable,
  tableStorageConnectionString,
} from "./tableStorageTestHelper";
import { putSavedVideoHandler, getSavedVideoHandler } from "../../src/auth/index";
import type { AuthenticatedUser, SavedVideoRequest } from "../../src/models/index";

function makeRequest(videoId: string, body?: unknown): HttpRequest {
  return {
    method: body === undefined ? "GET" : "PUT",
    url: `http://localhost:7071/api/saved-videos/${videoId}`,
    params: { videoId },
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => Promise.resolve(body),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: noop, error: noop, warn: noop } as unknown as InvocationContext;
}
function noop(): void {
  /* no-op */
}

function makeSaveRequest(overrides: Partial<SavedVideoRequest> = {}): SavedVideoRequest {
  return {
    videoTitle: "Cross-device video",
    channelName: "Chan",
    videoUrl: "https://youtube.com/watch?v=abc12345678",
    durationSeconds: 300,
    summary: {
      videoId: "abc12345678",
      tldr: ["A takeaway."],
      topics: [],
      steps: [],
      references: [],
      analyzedAt: "2026-01-01T00:00:00.000Z",
    },
    messages: [{ id: "m1", role: "user", content: "hi", type: "chat", timestamp: 1 }],
    ...overrides,
  };
}

describe("Saved videos cross-device access — integration (US4)", () => {
  beforeAll(async () => {
    await startAzuriteTable();
    process.env.AzureWebJobsStorage = tableStorageConnectionString();
  }, 30_000);

  afterAll(async () => {
    await stopAzuriteTable();
  });

  it("a video saved on 'device 1' is immediately visible to an independent request as 'device 2' sharing the same sub", async () => {
    const sharedSub: AuthenticatedUser = { sub: "sub-cross-device", email: "same-account@example.com" };

    const deviceOnePut = await putSavedVideoHandler(
      makeRequest("abc12345678", makeSaveRequest()),
      makeContext(),
      sharedSub
    );
    expect(deviceOnePut.status).toBe(200);

    // A second, fully independent request object simulating a different device/session,
    // authenticated as the same Google account (same sub) — no shared in-memory state.
    const deviceTwoGet = await getSavedVideoHandler(
      makeRequest("abc12345678"),
      makeContext(),
      { sub: sharedSub.sub, email: sharedSub.email }
    );

    expect(deviceTwoGet.status).toBe(200);
    const body = deviceTwoGet.jsonBody as { videoTitle: string; messages: unknown };
    expect(body.videoTitle).toBe("Cross-device video");
    expect(body.messages).toEqual(makeSaveRequest().messages);
  });

  it("an update from 'device 2' is immediately visible to 'device 1' on its next read (last-write-wins, FR-020)", async () => {
    const sharedSub: AuthenticatedUser = { sub: "sub-cross-device-2", email: "same-account2@example.com" };

    await putSavedVideoHandler(
      makeRequest("dQw4w9WgXcQ", makeSaveRequest()),
      makeContext(),
      sharedSub
    );

    const updatedMessages = [
      ...makeSaveRequest().messages,
      { id: "m2", role: "assistant" as const, content: "reply from device 2", type: "chat" as const, timestamp: 2 },
    ];
    const deviceTwoPut = await putSavedVideoHandler(
      makeRequest("dQw4w9WgXcQ", makeSaveRequest({ messages: updatedMessages })),
      makeContext(),
      { sub: sharedSub.sub, email: "same-account2@example.com" }
    );
    expect(deviceTwoPut.status).toBe(200);

    const deviceOneGet = await getSavedVideoHandler(
      makeRequest("dQw4w9WgXcQ"),
      makeContext(),
      sharedSub
    );

    expect(deviceOneGet.status).toBe(200);
    const body = deviceOneGet.jsonBody as { messages: unknown };
    expect(body.messages).toEqual(updatedMessages);
  });
});
