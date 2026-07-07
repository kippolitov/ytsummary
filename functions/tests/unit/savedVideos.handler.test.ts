import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";

vi.mock("../../src/services/savedVideosStore", () => ({
  saveVideo: vi.fn(),
  getVideo: vi.fn(),
  listVideos: vi.fn(),
  deleteVideo: vi.fn(),
}));

import {
  putSavedVideoHandler,
  getSavedVideoHandler,
  listSavedVideosHandler,
  deleteSavedVideoHandler,
} from "../../src/auth/index";
import { saveVideo, getVideo, listVideos, deleteVideo } from "../../src/services/savedVideosStore";
import type { SavedVideoDetailResponse, SavedVideoSummaryResponse } from "../../src/models/index";

const USER = { sub: "sub-1", email: "user@example.com" };

function makeRequest(videoId: string, body?: unknown): HttpRequest {
  return {
    method: body === undefined ? "GET" : "PUT",
    url: `http://localhost:7071/api/saved-videos/${videoId}`,
    params: { videoId },
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;
}

const validBody = {
  videoTitle: "Test video",
  channelName: "Chan",
  videoUrl: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 300,
  summary: { videoId: "abc12345678", tldr: ["x"], topics: [], steps: [], references: [], analyzedAt: "2026-01-01T00:00:00.000Z" },
  messages: [{ id: "m1", role: "user" as const, content: "hi", type: "chat" as const, timestamp: 1 }],
};

const detailResponse: SavedVideoDetailResponse = {
  videoId: "abc12345678",
  ...validBody,
  savedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("putSavedVideoHandler", () => {
  beforeEach(() => {
    vi.mocked(saveVideo).mockReset();
  });

  it("returns 400 for an invalid videoId", async () => {
    const response = await putSavedVideoHandler(makeRequest("bad-id", validBody), makeContext(), USER);
    expect(response.status).toBe(400);
    expect(saveVideo).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const response = await putSavedVideoHandler(
      makeRequest("abc12345678", new Error("bad json")),
      makeContext(),
      USER
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when the body is missing required fields", async () => {
    const response = await putSavedVideoHandler(
      makeRequest("abc12345678", { videoTitle: "x" }),
      makeContext(),
      USER
    );
    expect(response.status).toBe(400);
    expect(saveVideo).not.toHaveBeenCalled();
  });

  it("returns 200 with the saved video on success", async () => {
    vi.mocked(saveVideo).mockResolvedValue({ ok: true, response: detailResponse });

    const response = await putSavedVideoHandler(makeRequest("abc12345678", validBody), makeContext(), USER);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual(detailResponse);
    expect(saveVideo).toHaveBeenCalledWith("sub-1", "abc12345678", validBody);
  });

  it("returns 409 saved-video-limit-reached when the store rejects the create", async () => {
    vi.mocked(saveVideo).mockResolvedValue({ ok: false, reason: "limit-reached" });

    const response = await putSavedVideoHandler(makeRequest("abc12345678", validBody), makeContext(), USER);

    expect(response.status).toBe(409);
    expect((response.jsonBody as { error: { code: string } }).error.code).toBe(
      "saved-video-limit-reached"
    );
  });

  it("returns 500 when the store throws", async () => {
    vi.mocked(saveVideo).mockRejectedValue(new Error("table storage down"));

    const response = await putSavedVideoHandler(makeRequest("abc12345678", validBody), makeContext(), USER);

    expect(response.status).toBe(500);
  });
});

describe("getSavedVideoHandler", () => {
  beforeEach(() => {
    vi.mocked(getVideo).mockReset();
  });

  it("returns 400 for an invalid videoId", async () => {
    const response = await getSavedVideoHandler(makeRequest("bad-id"), makeContext(), USER);
    expect(response.status).toBe(400);
    expect(getVideo).not.toHaveBeenCalled();
  });

  it("returns 200 with the saved video", async () => {
    vi.mocked(getVideo).mockResolvedValue(detailResponse);

    const response = await getSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual(detailResponse);
    expect(getVideo).toHaveBeenCalledWith("sub-1", "abc12345678");
  });

  it("returns 404 not-found when nothing is saved for this videoId", async () => {
    vi.mocked(getVideo).mockResolvedValue(null);

    const response = await getSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);

    expect(response.status).toBe(404);
    expect((response.jsonBody as { error: { code: string } }).error.code).toBe("not-found");
  });

  it("returns 500 when the store throws", async () => {
    vi.mocked(getVideo).mockRejectedValue(new Error("table storage down"));

    const response = await getSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);

    expect(response.status).toBe(500);
  });
});

const summaryList: SavedVideoSummaryResponse[] = [
  {
    videoId: "abc12345678",
    videoTitle: "Test video",
    channelName: "Chan",
    videoUrl: "https://youtube.com/watch?v=abc12345678",
    durationSeconds: 300,
    savedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("listSavedVideosHandler", () => {
  beforeEach(() => {
    vi.mocked(listVideos).mockReset();
  });

  it("returns 200 with the videos list, scoped to the caller's sub", async () => {
    vi.mocked(listVideos).mockResolvedValue(summaryList);

    const response = await listSavedVideosHandler(makeRequest(""), makeContext(), USER);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ videos: summaryList });
    expect(listVideos).toHaveBeenCalledWith("sub-1");
  });

  it("returns an empty list (not an error) when nothing is saved", async () => {
    vi.mocked(listVideos).mockResolvedValue([]);

    const response = await listSavedVideosHandler(makeRequest(""), makeContext(), USER);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ videos: [] });
  });

  it("returns 500 when the store throws", async () => {
    vi.mocked(listVideos).mockRejectedValue(new Error("table storage down"));

    const response = await listSavedVideosHandler(makeRequest(""), makeContext(), USER);

    expect(response.status).toBe(500);
  });
});

describe("deleteSavedVideoHandler", () => {
  beforeEach(() => {
    vi.mocked(deleteVideo).mockReset().mockResolvedValue(undefined);
  });

  it("returns 400 for an invalid videoId", async () => {
    const response = await deleteSavedVideoHandler(makeRequest("bad-id"), makeContext(), USER);
    expect(response.status).toBe(400);
    expect(deleteVideo).not.toHaveBeenCalled();
  });

  it("returns 204 on success, scoped to the caller's sub", async () => {
    const response = await deleteSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);
    expect(response.status).toBe(204);
    expect(deleteVideo).toHaveBeenCalledWith("sub-1", "abc12345678");
  });

  it("returns 204 even when the video was already absent (idempotent)", async () => {
    const response = await deleteSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);
    expect(response.status).toBe(204);
  });

  it("returns 500 when the store throws", async () => {
    vi.mocked(deleteVideo).mockRejectedValue(new Error("table storage down"));

    const response = await deleteSavedVideoHandler(makeRequest("abc12345678"), makeContext(), USER);

    expect(response.status).toBe(500);
  });
});
