import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../services/authClient", () => ({
  getIdToken: vi.fn(),
}));

import { postAnalysis } from "../../services/analysisClient";
import { getIdToken } from "../../services/authClient";
import type { AnalysisResult, Video } from "../../types/index";

const video: Video = {
  videoId: "abc12345678",
  title: "Test Video",
  channelName: "Test Channel",
  url: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 600,
  transcript: "The transcript.",
};

const result: AnalysisResult = {
  videoId: video.videoId,
  tldr: ["A takeaway."],
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-06-10T10:00:00Z",
};

describe("analysisClient — postAnalysis", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api/analyze");
    vi.stubGlobal("WXT_AZURE_FUNCTION_KEY", "test-key");
    vi.mocked(getIdToken).mockReset().mockResolvedValue("test-id-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the analysis result on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200 })
    );

    await expect(postAnalysis(video)).resolves.toEqual(result);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("code=test-key");
    const sentBody = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect(sentBody).toMatchObject({
      videoId: video.videoId,
      title: video.title,
      channelName: video.channelName,
      transcript: video.transcript,
      durationSeconds: video.durationSeconds,
    });
  });

  it("omits the code query param when no function key is configured", async () => {
    vi.stubGlobal("WXT_AZURE_FUNCTION_KEY", "");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200 })
    );

    await postAnalysis(video);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).not.toContain("code=");
  });

  it("throws a non-retryable service-error when the URL is not configured", async () => {
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "");
    await expect(postAnalysis(video)).rejects.toMatchObject({
      code: "service-error",
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws a retryable network-error when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(postAnalysis(video)).rejects.toMatchObject({
      code: "network-error",
      retryable: true,
    });
  });

  it.each([
    [400, "unknown", false],
    [422, "transcript-too-long", false],
    [429, "rate-limited", true],
    [500, "service-error", true],
    [503, "service-error", true],
    [418, "unknown", true],
    [401, "unauthenticated", false],
    [403, "not-authorized", false],
  ])("maps HTTP %i to PanelError code %s", async (status, code, retryable) => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
    await expect(postAnalysis(video)).rejects.toMatchObject({ code, retryable });
  });

  it("attaches the Authorization bearer header when a token is available", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

    await postAnalysis(video);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("Authorization")).toBe("Bearer test-id-token");
  });

  it("omits the Authorization header when no token is stored", async () => {
    vi.mocked(getIdToken).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

    await postAnalysis(video);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.has("Authorization")).toBe(false);
  });
});
