import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../services/authClient", () => ({
  getIdToken: vi.fn(),
}));

import { saveVideo, getSavedVideo, listSavedVideos, deleteSavedVideo } from "../../services/savedVideosClient";
import { getIdToken } from "../../services/authClient";
import type { SaveVideoInput } from "../../services/savedVideosClient";
import type { SavedVideoDetail } from "../../types/index";

const input: SaveVideoInput = {
  videoTitle: "Test video",
  channelName: "Chan",
  videoUrl: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 300,
  summary: { videoId: "abc12345678", tldr: ["x"], topics: [], steps: [], references: [], analyzedAt: "2026-01-01T00:00:00.000Z" },
  messages: [{ id: "m1", role: "user", content: "hi", type: "chat", timestamp: 1 }],
};

const detail: SavedVideoDetail = {
  videoId: "abc12345678",
  ...input,
  savedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("savedVideosClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api/analyze");
    vi.stubGlobal("WXT_AZURE_FUNCTION_KEY", "test-key");
    vi.mocked(getIdToken).mockReset().mockResolvedValue("test-id-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("saveVideo", () => {
    it("PUTs to /api/saved-videos/{videoId} with the Authorization header and returns the saved video", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

      const result = await saveVideo("abc12345678", input);

      expect(result).toEqual(detail);
      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toContain("/api/saved-videos/abc12345678");
      expect(String(url)).toContain("code=test-key");
      expect((init as RequestInit).method).toBe("PUT");
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get("Authorization")).toBe("Bearer test-id-token");
      expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
    });

    it("maps 409 to saved-video-limit-reached", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "saved-video-limit-reached", message: "remove one first" } }),
          { status: 409 }
        )
      );

      await expect(saveVideo("abc12345678", input)).rejects.toMatchObject({
        code: "saved-video-limit-reached",
        message: "remove one first",
      });
    });

    it("maps 401/403 to unauthenticated/not-authorized", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
      await expect(saveVideo("abc12345678", input)).rejects.toMatchObject({ code: "unauthenticated" });

      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 403 }));
      await expect(saveVideo("abc12345678", input)).rejects.toMatchObject({ code: "not-authorized" });
    });

    it("maps a network failure to network-error", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(saveVideo("abc12345678", input)).rejects.toMatchObject({ code: "network-error" });
    });

    it("throws a non-retryable service-error when the URL is not configured", async () => {
      vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "");
      await expect(saveVideo("abc12345678", input)).rejects.toMatchObject({ code: "service-error" });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("getSavedVideo", () => {
    it("GETs /api/saved-videos/{videoId} and returns the saved video", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

      const result = await getSavedVideo("abc12345678");

      expect(result).toEqual(detail);
      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      expect((init as RequestInit).method).toBe("GET");
    });

    it("returns null (not an error) on 404", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 404 }));
      expect(await getSavedVideo("abc12345678")).toBeNull();
    });

    it("maps 500 to service-error", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 500 }));
      await expect(getSavedVideo("abc12345678")).rejects.toMatchObject({ code: "service-error" });
    });
  });

  describe("listSavedVideos", () => {
    it("GETs /api/saved-videos and returns the videos array", async () => {
      const videos = [
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
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ videos }), { status: 200 }));

      const result = await listSavedVideos();

      expect(result).toEqual(videos);
      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toContain("/api/saved-videos");
      expect(String(url)).not.toContain("/api/saved-videos/");
      expect((init as RequestInit).method).toBe("GET");
    });

    it("returns an empty array (not an error) when nothing is saved", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ videos: [] }), { status: 200 }));
      expect(await listSavedVideos()).toEqual([]);
    });

    it("maps a non-200 response to a SavedVideoError", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
      await expect(listSavedVideos()).rejects.toMatchObject({ code: "unauthenticated" });
    });
  });

  describe("deleteSavedVideo", () => {
    it("DELETEs /api/saved-videos/{videoId}", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

      await deleteSavedVideo("abc12345678");

      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toContain("/api/saved-videos/abc12345678");
      expect((init as RequestInit).method).toBe("DELETE");
    });

    it("throws a SavedVideoError on failure", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
      await expect(deleteSavedVideo("abc12345678")).rejects.toMatchObject({ code: "service-error" });
    });
  });
});
