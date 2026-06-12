import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
}));

import { fetchTranscript } from "../../src/services/transcriptFetcher";
import { YoutubeTranscript } from "youtube-transcript";

describe("transcriptFetcher", () => {
  beforeEach(() => {
    vi.mocked(YoutubeTranscript.fetchTranscript).mockReset();
  });

  it("joins segment texts into a single transcript", async () => {
    vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue([
      { text: "Hello", duration: 1, offset: 0, lang: "en" },
      { text: "world", duration: 1, offset: 1, lang: "en" },
    ]);

    await expect(fetchTranscript("abc12345678")).resolves.toBe("Hello world");
  });

  it("returns null when no segments are returned", async () => {
    vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue([]);
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });

  it("returns null when segments contain only whitespace", async () => {
    vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue([
      { text: " ", duration: 1, offset: 0, lang: "en" },
    ]);
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    vi.mocked(YoutubeTranscript.fetchTranscript).mockRejectedValue(
      new Error("Transcript is disabled")
    );
    await expect(fetchTranscript("abc12345678")).resolves.toBeNull();
  });
});
