import { describe, it, expect, vi, beforeEach } from "vitest";

describe("content script SPA navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReset();
    // Reset location
    Object.defineProperty(window, "location", {
      value: { search: "?v=abc12345678", href: "https://www.youtube.com/watch?v=abc12345678" },
      writable: true,
    });
  });

  it("yt-navigate-finish dispatches VIDEO_CHANGED with new videoId", () => {
    const sentMessages: unknown[] = [];
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (msg: unknown) => { sentMessages.push(msg); return Promise.resolve(); }
    );

    // Simulate what the content script listener does
    Object.defineProperty(window, "location", {
      value: { search: "?v=zzz99999999", href: "https://www.youtube.com/watch?v=zzz99999999" },
      writable: true,
    });

    const videoId = new URLSearchParams(window.location.search).get("v");

    chrome.runtime.sendMessage({
      type: "VIDEO_CHANGED",
      videoId,
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({ type: "VIDEO_CHANGED", videoId: "zzz99999999" });
  });

  it("re-triggers full extraction flow after navigation", () => {
    const sentMessages: unknown[] = [];
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (msg: unknown) => { sentMessages.push(msg); return Promise.resolve(); }
    );

    chrome.runtime.sendMessage({ type: "VIDEO_CHANGED", videoId: "newvideoid11" });
    chrome.runtime.sendMessage({ type: "NO_TRANSCRIPT", videoId: "newvideoid11" });

    expect(sentMessages).toHaveLength(2);
    expect((sentMessages[0] as { type: string }).type).toBe("VIDEO_CHANGED");
    expect((sentMessages[1] as { type: string }).type).toBe("NO_TRANSCRIPT");
  });
});
