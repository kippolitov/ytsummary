import { describe, it, expect, vi, beforeEach } from "vitest";
import { getResult, setResult, hasResult, storeVideo, getVideo } from "../../services/sessionCache";
import type { AnalysisResult, Video } from "../../types/index";

const mockResult: AnalysisResult = {
  videoId: "abc12345678",
  summary: "A test summary.",
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-06-05T10:00:00Z",
};

describe("sessionCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset chrome.storage.session mock to empty state
    const storageMock = chrome.storage.session as {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    storageMock.get.mockReset();
    storageMock.set.mockReset();
  });

  it("getResult returns null for an empty cache", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await getResult("abc12345678");
    expect(result).toBeNull();
  });

  it("setResult then getResult returns the stored value", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await getResult("abc12345678");
    expect(result).toEqual(mockResult);
  });

  it("distinct videoIds are isolated in the cache", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await getResult("zzz99999999");
    expect(result).toBeNull();
  });

  it("hasResult returns false for missing key", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await hasResult("abc12345678");
    expect(result).toBe(false);
  });

  it("hasResult returns true after setResult", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );

    await setResult("abc12345678", mockResult);
    const result = await hasResult("abc12345678");
    expect(result).toBe(true);
  });
});

const mockVideo: Video = {
  videoId: "abc12345678",
  title: "Test Video",
  channelName: "Test Channel",
  url: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 600,
  transcript: "This is the full transcript.",
};

describe("sessionCache — storeVideo / getVideo", () => {
  beforeEach(() => {
    const storageMock = chrome.storage.session as {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    storageMock.get.mockReset();
    storageMock.set.mockReset();
  });

  it("getVideo returns null when no video is cached", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await getVideo("abc12345678");
    expect(result).toBeNull();
  });

  it("storeVideo then getVideo returns the stored video", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => ({ [key]: store[key] })
    );
    await storeVideo(mockVideo);
    const result = await getVideo("abc12345678");
    expect(result).toEqual(mockVideo);
  });

  it("storeVideo truncates transcript to 80000 characters", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    const longVideo: Video = { ...mockVideo, transcript: "x".repeat(100_000) };
    await storeVideo(longVideo);
    const stored = store[`video_${mockVideo.videoId}`] as Video;
    expect(stored.transcript.length).toBe(80_000);
  });

  it("storeVideo stores under video_${videoId} key", async () => {
    const store: Record<string, unknown> = {};
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockImplementation(
      async (data: Record<string, unknown>) => { Object.assign(store, data); }
    );
    await storeVideo(mockVideo);
    expect(store["video_abc12345678"]).toBeDefined();
  });
});
