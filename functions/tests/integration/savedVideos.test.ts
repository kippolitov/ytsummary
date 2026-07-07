import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import {
  startAzuriteTable,
  stopAzuriteTable,
  tableStorageConnectionString,
} from "./tableStorageTestHelper";

import {
  putSavedVideoHandler,
  getSavedVideoHandler,
  listSavedVideosHandler,
  deleteSavedVideoHandler,
} from "../../src/auth/index";
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
  return { log: vi_noop, error: vi_noop, warn: vi_noop } as unknown as InvocationContext;
}
// Minimal no-op logger (avoids pulling vitest's vi into a non-mocked integration file).
function vi_noop(): void {
  /* no-op */
}

function makeSaveRequest(overrides: Partial<SavedVideoRequest> = {}): SavedVideoRequest {
  return {
    videoTitle: "Test video",
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

describe("Saved videos save/get — integration (Azurite)", () => {
  beforeAll(async () => {
    await startAzuriteTable();
    process.env.AzureWebJobsStorage = tableStorageConnectionString();
  }, 30_000);

  afterAll(async () => {
    await stopAzuriteTable();
  });

  it("save-or-update then get-one round trip preserves summary and chat", async () => {
    const user: AuthenticatedUser = { sub: "sub-roundtrip", email: "a@example.com" };
    const req = makeSaveRequest();

    const putResponse = await putSavedVideoHandler(
      makeRequest("abc12345678", req),
      makeContext(),
      user
    );
    expect(putResponse.status).toBe(200);

    const getResponse = await getSavedVideoHandler(makeRequest("abc12345678"), makeContext(), user);
    expect(getResponse.status).toBe(200);
    const body = getResponse.jsonBody as { summary: unknown; messages: unknown; savedAt: string };
    expect(body.summary).toEqual(req.summary);
    expect(body.messages).toEqual(req.messages);
    expect(body.savedAt).toBeTruthy();
  });

  it("updating an already-saved video preserves savedAt and appends new messages", async () => {
    const user: AuthenticatedUser = { sub: "sub-update", email: "b@example.com" };
    const first = await putSavedVideoHandler(
      makeRequest("dQw4w9WgXcQ", makeSaveRequest()),
      makeContext(),
      user
    );
    const firstBody = first.jsonBody as { savedAt: string };

    const updatedMessages = [
      ...makeSaveRequest().messages,
      { id: "m2", role: "assistant" as const, content: "reply", type: "chat" as const, timestamp: 2 },
    ];
    const second = await putSavedVideoHandler(
      makeRequest("dQw4w9WgXcQ", makeSaveRequest({ messages: updatedMessages })),
      makeContext(),
      user
    );
    const secondBody = second.jsonBody as { savedAt: string; messages: unknown };

    expect(secondBody.savedAt).toBe(firstBody.savedAt);
    expect(secondBody.messages).toEqual(updatedMessages);
  });

  it("returns 404 not-found for a videoId nothing has been saved under", async () => {
    const user: AuthenticatedUser = { sub: "sub-missing", email: "c@example.com" };
    const response = await getSavedVideoHandler(makeRequest("zzzzzzzzzzz"), makeContext(), user);
    expect(response.status).toBe(404);
  });

  it("cap boundary: rejects the 201st create at 200 existing rows, but an update to an existing row still succeeds", async () => {
    const user: AuthenticatedUser = { sub: "sub-cap", email: "d@example.com" };

    for (let i = 0; i < 200; i++) {
      const videoId = `cap${String(i).padStart(8, "0")}`;
      const response = await putSavedVideoHandler(
        makeRequest(videoId, makeSaveRequest()),
        makeContext(),
        user
      );
      expect(response.status).toBe(200);
    }

    const rejected = await putSavedVideoHandler(
      makeRequest("cap99999999", makeSaveRequest()),
      makeContext(),
      user
    );
    expect(rejected.status).toBe(409);
    expect((rejected.jsonBody as { error: { code: string } }).error.code).toBe(
      "saved-video-limit-reached"
    );

    const updateExisting = await putSavedVideoHandler(
      makeRequest("cap00000000", makeSaveRequest({ videoTitle: "Updated title" })),
      makeContext(),
      user
    );
    expect(updateExisting.status).toBe(200);
    expect((updateExisting.jsonBody as { videoTitle: string }).videoTitle).toBe("Updated title");
  }, 30_000);

  it("cross-account isolation: two accounts saving the same videoId never see or affect each other's row (FR-010)", async () => {
    const userA: AuthenticatedUser = { sub: "sub-A", email: "a2@example.com" };
    const userB: AuthenticatedUser = { sub: "sub-B", email: "b2@example.com" };
    const sharedVideoId = "shared12345";

    await putSavedVideoHandler(
      makeRequest(sharedVideoId, makeSaveRequest({ videoTitle: "A's title" })),
      makeContext(),
      userA
    );
    await putSavedVideoHandler(
      makeRequest(sharedVideoId, makeSaveRequest({ videoTitle: "B's title" })),
      makeContext(),
      userB
    );

    const aResponse = await getSavedVideoHandler(makeRequest(sharedVideoId), makeContext(), userA);
    const bResponse = await getSavedVideoHandler(makeRequest(sharedVideoId), makeContext(), userB);

    expect((aResponse.jsonBody as { videoTitle: string }).videoTitle).toBe("A's title");
    expect((bResponse.jsonBody as { videoTitle: string }).videoTitle).toBe("B's title");
  });

  it("list + delete round trip: saved videos appear in the list, and unsaving removes them", async () => {
    const user: AuthenticatedUser = { sub: "sub-list-delete", email: "e@example.com" };

    await putSavedVideoHandler(
      makeRequest("listone1234", makeSaveRequest({ videoTitle: "First" })),
      makeContext(),
      user
    );
    await putSavedVideoHandler(
      makeRequest("listtwo1234", makeSaveRequest({ videoTitle: "Second" })),
      makeContext(),
      user
    );

    const listResponse = await listSavedVideosHandler(makeRequest(""), makeContext(), user);
    expect(listResponse.status).toBe(200);
    const { videos } = listResponse.jsonBody as {
      videos: Array<{ videoId: string; videoTitle: string; summary?: unknown }>;
    };
    expect(videos.map((v) => v.videoId).sort()).toEqual(["listone1234", "listtwo1234"]);
    // list entries omit summary/chat content (FR-012)
    expect(videos[0].summary).toBeUndefined();

    const deleteResponse = await deleteSavedVideoHandler(
      makeRequest("listone1234"),
      makeContext(),
      user
    );
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await listSavedVideosHandler(makeRequest(""), makeContext(), user);
    const { videos: videosAfterDelete } = afterDelete.jsonBody as {
      videos: Array<{ videoId: string }>;
    };
    expect(videosAfterDelete.map((v) => v.videoId)).toEqual(["listtwo1234"]);

    // deleting an already-absent video is idempotent, not an error
    const secondDelete = await deleteSavedVideoHandler(
      makeRequest("listone1234"),
      makeContext(),
      user
    );
    expect(secondDelete.status).toBe(204);
  });
});
