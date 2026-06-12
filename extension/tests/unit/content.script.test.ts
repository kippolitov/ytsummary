import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { MessageType } from "../../types/messages";
import type { TranscriptReadyMessage } from "../../types/messages";

function postWindowMessage(data: unknown, source: MessageEventSource | null = window): void {
  window.dispatchEvent(new MessageEvent("message", { data, source }));
}

function sentMessages(): unknown[] {
  return (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
}

beforeAll(async () => {
  vi.stubGlobal("defineContentScript", (def: { main: () => void }) => def);
  const entrypoint = (await import("../../entrypoints/content")).default as {
    main: () => void;
  };
  entrypoint.main();
});

describe("content entrypoint", () => {
  beforeEach(() => {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReset();
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    document.head.innerHTML = "";
    document.title = "Cool Video - YouTube";
  });

  it("forwards YT_VIDEO_CHANGED as a VIDEO_CHANGED runtime message", () => {
    postWindowMessage({ type: "YT_VIDEO_CHANGED", videoId: "abc12345678" });

    expect(sentMessages()).toContainEqual({
      type: MessageType.VIDEO_CHANGED,
      videoId: "abc12345678",
    });
  });

  it("forwards YT_TRANSCRIPT as TRANSCRIPT_READY with page metadata", () => {
    document.title = "My Tutorial – YouTube";
    const meta = document.createElement("meta");
    meta.setAttribute("itemprop", "author");
    meta.content = "Channel Author";
    document.head.appendChild(meta);

    postWindowMessage({
      type: "YT_TRANSCRIPT",
      videoId: "abc12345678",
      transcript: "Hello transcript",
    });

    const msg = sentMessages().find(
      (m) => (m as { type: string }).type === MessageType.TRANSCRIPT_READY
    ) as TranscriptReadyMessage;
    expect(msg).toBeDefined();
    expect(msg.video).toMatchObject({
      videoId: "abc12345678",
      title: "My Tutorial",
      channelName: "Channel Author",
      transcript: "Hello transcript",
    });
  });

  it("falls back to the link[itemprop=name] element for the channel name", () => {
    const link = document.createElement("link");
    link.setAttribute("itemprop", "name");
    link.setAttribute("content", "Linked Channel");
    document.head.appendChild(link);

    postWindowMessage({ type: "YT_TRANSCRIPT", videoId: "abc12345678", transcript: "t" });

    const msg = sentMessages()[0] as TranscriptReadyMessage;
    expect(msg.video.channelName).toBe("Linked Channel");
  });

  it("uses an empty channel name when no metadata exists", () => {
    postWindowMessage({ type: "YT_TRANSCRIPT", videoId: "abc12345678", transcript: "t" });
    const msg = sentMessages()[0] as TranscriptReadyMessage;
    expect(msg.video.channelName).toBe("");
  });

  it("defaults a missing transcript payload to an empty string", () => {
    postWindowMessage({ type: "YT_TRANSCRIPT", videoId: "abc12345678" });
    const msg = sentMessages()[0] as TranscriptReadyMessage;
    expect(msg.video.transcript).toBe("");
  });

  it("ignores messages from other sources", () => {
    postWindowMessage({ type: "YT_VIDEO_CHANGED", videoId: "abc12345678" }, null);
    expect(sentMessages()).toHaveLength(0);
  });

  it("ignores messages without a type", () => {
    postWindowMessage({ videoId: "abc12345678" });
    postWindowMessage(null);
    expect(sentMessages()).toHaveLength(0);
  });

  it("ignores unrelated message types", () => {
    postWindowMessage({ type: "SOMETHING_ELSE" });
    expect(sentMessages()).toHaveLength(0);
  });

  it("swallows runtime sendMessage failures", () => {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("no receiver")
    );
    expect(() =>
      postWindowMessage({ type: "YT_VIDEO_CHANGED", videoId: "abc12345678" })
    ).not.toThrow();
  });
});
