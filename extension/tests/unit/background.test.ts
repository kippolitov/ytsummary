import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { MessageType } from "../../types/messages";
import type { ExtensionMessage } from "../../types/messages";
import type { AnalysisResult, PanelError, Video } from "../../types/index";

vi.mock("../../services/analysisClient", () => ({
  postAnalysis: vi.fn(),
}));
vi.mock("../../services/sessionCache", () => ({
  getResult: vi.fn(),
  hasResult: vi.fn(),
  setResult: vi.fn(),
  setLastVideo: vi.fn(),
  getLastVideo: vi.fn(),
  storeVideo: vi.fn(),
}));

import { postAnalysis } from "../../services/analysisClient";
import {
  getResult,
  hasResult,
  setResult,
  setLastVideo,
  getLastVideo,
  storeVideo,
} from "../../services/sessionCache";

type MessageListener = (
  message: ExtensionMessage,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean;

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

let listener: MessageListener;

function sentMessages(): ExtensionMessage[] {
  return (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls.map(
    (c) => c[0] as ExtensionMessage
  );
}

async function dispatch(message: ExtensionMessage): Promise<void> {
  const sendResponse = vi.fn();
  const keepAlive = listener(message, {}, sendResponse);
  expect(keepAlive).toBe(true);
  expect(sendResponse).toHaveBeenCalledWith({ received: true });
  // let the async handler chain settle
  await vi.waitFor(() => expect(sentMessages().length).toBeGreaterThan(0));
}

beforeAll(async () => {
  vi.stubGlobal("defineBackground", (def: { main: () => void }) => def);
  vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api/analyze");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  const entrypoint = (await import("../../entrypoints/background")).default as {
    main: () => void;
  };
  entrypoint.main();

  const addListener = chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;
  listener = addListener.mock.calls.at(-1)![0] as MessageListener;
});

describe("background entrypoint", () => {
  beforeEach(() => {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReset();
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    vi.mocked(postAnalysis).mockReset();
    vi.mocked(hasResult).mockResolvedValue(false);
    vi.mocked(getResult).mockResolvedValue(null);
    vi.mocked(setResult).mockResolvedValue(undefined);
    vi.mocked(setLastVideo).mockResolvedValue(undefined);
    vi.mocked(getLastVideo).mockResolvedValue(null);
    vi.mocked(storeVideo).mockResolvedValue(undefined);
  });

  it("registers panel behavior on startup", () => {
    expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    });
  });

  it("TRANSCRIPT_READY broadcasts a cached result without re-analyzing", async () => {
    vi.mocked(hasResult).mockResolvedValue(true);
    vi.mocked(getResult).mockResolvedValue(result);

    await dispatch({ type: MessageType.TRANSCRIPT_READY, video });

    expect(setLastVideo).toHaveBeenCalledWith({
      videoId: video.videoId,
      title: video.title,
      channelName: video.channelName,
    });
    expect(storeVideo).toHaveBeenCalledWith(video);
    expect(postAnalysis).not.toHaveBeenCalled();
    expect(sentMessages()).toContainEqual({ type: MessageType.ANALYSIS_RESULT, result });
  });

  it("TRANSCRIPT_READY analyzes and caches when no cached result exists", async () => {
    vi.mocked(postAnalysis).mockResolvedValue(result);

    await dispatch({ type: MessageType.TRANSCRIPT_READY, video });

    expect(postAnalysis).toHaveBeenCalledWith(video);
    await vi.waitFor(() => expect(setResult).toHaveBeenCalledWith(video.videoId, result));
    expect(sentMessages()).toContainEqual({ type: MessageType.ANALYSIS_RESULT, result });
  });

  it("TRANSCRIPT_READY broadcasts the PanelError when analysis fails", async () => {
    const panelError: PanelError = {
      code: "service-error",
      message: "Boom.",
      action: "Try again.",
      retryable: true,
    };
    vi.mocked(postAnalysis).mockRejectedValue(panelError);

    await dispatch({ type: MessageType.TRANSCRIPT_READY, video });

    expect(sentMessages()).toContainEqual({
      type: MessageType.ANALYSIS_ERROR,
      error: panelError,
    });
  });

  it("maps a non-PanelError failure to a generic retryable error", async () => {
    vi.mocked(postAnalysis).mockRejectedValue(new Error("network down"));

    await dispatch({ type: MessageType.TRANSCRIPT_READY, video });

    expect(sentMessages()).toContainEqual({
      type: MessageType.ANALYSIS_ERROR,
      error: {
        code: "unknown",
        message: "An unexpected error occurred.",
        action: "Try again.",
        retryable: true,
      },
    });
  });

  it("waits 10 seconds before broadcasting a rate-limited error", async () => {
    vi.useFakeTimers();
    try {
      const rateLimited: PanelError = {
        code: "rate-limited",
        message: "Busy.",
        action: "Try again in a moment.",
        retryable: true,
      };
      vi.mocked(postAnalysis).mockRejectedValue(rateLimited);

      const sendResponse = vi.fn();
      listener({ type: MessageType.TRANSCRIPT_READY, video }, {}, sendResponse);

      // flush the pre-sleep async work, then verify nothing was broadcast yet
      await vi.advanceTimersByTimeAsync(9_000);
      expect(sentMessages()).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1_100);
      expect(sentMessages()).toContainEqual({
        type: MessageType.ANALYSIS_ERROR,
        error: rateLimited,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("NO_TRANSCRIPT broadcasts a non-retryable error", async () => {
    await dispatch({ type: MessageType.NO_TRANSCRIPT, videoId: video.videoId });

    expect(sentMessages()).toContainEqual({
      type: MessageType.ANALYSIS_ERROR,
      error: expect.objectContaining({ retryable: false }),
    });
  });

  it("RETRY_ANALYSIS re-analyzes using the last video metadata", async () => {
    vi.mocked(getLastVideo).mockResolvedValue({
      videoId: video.videoId,
      title: video.title,
      channelName: video.channelName,
    });
    vi.mocked(postAnalysis).mockResolvedValue(result);

    await dispatch({ type: MessageType.RETRY_ANALYSIS, videoId: video.videoId });

    expect(postAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: video.videoId,
        title: video.title,
        channelName: video.channelName,
      })
    );
    expect(sentMessages()).toContainEqual({ type: MessageType.ANALYSIS_RESULT, result });
  });

  it("RETRY_ANALYSIS falls back to empty metadata and broadcasts errors", async () => {
    const panelError: PanelError = {
      code: "network-error",
      message: "Offline.",
      action: "Check your connection.",
      retryable: true,
    };
    vi.mocked(postAnalysis).mockRejectedValue(panelError);

    await dispatch({ type: MessageType.RETRY_ANALYSIS, videoId: video.videoId });

    expect(postAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: video.videoId, title: "", channelName: "" })
    );
    expect(sentMessages()).toContainEqual({
      type: MessageType.ANALYSIS_ERROR,
      error: panelError,
    });
  });

  it("swallows broadcast failures when the side panel is closed", async () => {
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Could not establish connection")
    );

    const sendResponse = vi.fn();
    listener({ type: MessageType.NO_TRANSCRIPT, videoId: video.videoId }, {}, sendResponse);

    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalled()
    );
    // no unhandled rejection — reaching this point is the assertion
  });
});
