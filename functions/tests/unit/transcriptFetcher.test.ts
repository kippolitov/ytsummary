import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchTranscriptMock = vi.hoisted(() => vi.fn());

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: fetchTranscriptMock,
  },
}));

import { fetchTranscript } from "../../src/services/transcriptFetcher";

describe("transcriptFetcher", () => {
  beforeEach(() => {
    fetchTranscriptMock.mockReset();
  });

  it("joins segment texts into a single transcript", async () => {
    fetchTranscriptMock.mockResolvedValue([
      { text: "Hello", duration: 1, offset: 0, lang: "en" },
      { text: "world", duration: 1, offset: 1, lang: "en" },
    ]);

    await expect(fetchTranscript("abc12345678")).resolves.toBe("Hello world");
    expect(fetchTranscriptMock).toHaveBeenCalledWith("abc12345678");
  });

  it("returns null when no segments are returned", async () => {
    fetchTranscriptMock.mockResolvedValue([]);
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });

  it("returns null when segments contain only whitespace", async () => {
    fetchTranscriptMock.mockResolvedValue([
      { text: " ", duration: 1, offset: 0, lang: "en" },
    ]);
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    fetchTranscriptMock.mockRejectedValue(new Error("Transcript is disabled"));
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });
});
