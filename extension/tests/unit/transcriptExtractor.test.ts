import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTranscript } from "../../services/transcriptExtractor";

describe("transcriptExtractor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when ytInitialPlayerResponse is not set", async () => {
    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = undefined;
    const result = await extractTranscript();
    expect(result).toBeNull();
  });

  it("returns null when captionTracks is empty", async () => {
    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [],
        },
      },
    };
    const result = await extractTranscript();
    expect(result).toBeNull();
  });

  it("returns null when captions key is missing", async () => {
    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = {};
    const result = await extractTranscript();
    expect(result).toBeNull();
  });

  it("fetches timedtext XML and concatenates <s> text nodes", async () => {
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<transcript>
  <text start="0.5" dur="1.0">Hello</text>
  <text start="2.0" dur="1.5">world</text>
</transcript>`;

    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://example.com/timedtext?v=test" },
          ],
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => xmlContent,
    } as Response);

    const result = await extractTranscript();
    expect(result).toBe("Hello world");
  });

  it("appends fmt=srv1 to the timedtext URL", async () => {
    const xmlContent = `<transcript><text start="0">hi</text></transcript>`;
    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://example.com/timedtext?v=abc" }],
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => xmlContent,
    } as Response);

    await extractTranscript();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("fmt=srv1")
    );
  });

  it("returns null when fetch fails", async () => {
    (globalThis as Record<string, unknown>).ytInitialPlayerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://example.com/timedtext?v=abc" }],
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await extractTranscript();
    expect(result).toBeNull();
  });
});
