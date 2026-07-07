import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
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
vi.mock("../../services/authClient", () => ({
  getStoredAuth: vi.fn(),
  signInSilently: vi.fn(),
  signOut: vi.fn(),
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
import { getStoredAuth, signInSilently, signOut as authSignOut } from "../../services/authClient";

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

type PortListener = (port: { name: string; onDisconnect: { addListener: (cb: () => void) => void } }) => void;
type TabActivatedListener = (info: { tabId: number }) => void;
type TabUpdatedListener = (
  tabId: number,
  changeInfo: { status?: string },
  tab: { active: boolean }
) => void;

let listener: MessageListener;
let ensureFreshAuth: () => Promise<void>;
let connectListener: PortListener;
let activatedListener: TabActivatedListener;
let updatedListener: TabUpdatedListener;

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

  vi.mocked(getStoredAuth).mockResolvedValue(null);

  const module = await import("../../entrypoints/background");
  const entrypoint = module.default as { main: () => void };
  ensureFreshAuth = module.ensureFreshAuth;
  entrypoint.main();

  const addListener = chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;
  listener = addListener.mock.calls.at(-1)![0] as MessageListener;

  const addConnectListener = chrome.runtime.onConnect.addListener as ReturnType<typeof vi.fn>;
  connectListener = addConnectListener.mock.calls.at(-1)![0] as PortListener;

  const addActivatedListener = chrome.tabs.onActivated.addListener as ReturnType<typeof vi.fn>;
  activatedListener = addActivatedListener.mock.calls.at(-1)![0] as TabActivatedListener;

  const addUpdatedListener = chrome.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>;
  updatedListener = addUpdatedListener.mock.calls.at(-1)![0] as TabUpdatedListener;
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

  describe("ensureFreshAuth (FR-006a)", () => {
    beforeEach(() => {
      vi.mocked(getStoredAuth).mockReset();
      vi.mocked(signInSilently).mockReset();
      vi.mocked(authSignOut).mockReset().mockResolvedValue(undefined);
    });

    it("does nothing when there is no existing session to refresh", async () => {
      vi.mocked(getStoredAuth).mockResolvedValue(null);

      await ensureFreshAuth();

      expect(signInSilently).not.toHaveBeenCalled();
      expect(authSignOut).not.toHaveBeenCalled();
    });

    it("does nothing when the stored token is not close to expiry", async () => {
      vi.mocked(getStoredAuth).mockResolvedValue({
        idToken: "t",
        expiresAt: Date.now() + 60 * 60 * 1000,
        user: { sub: "s", email: "e@x.com" },
        authorizationStatus: "authorized",
      });

      await ensureFreshAuth();

      expect(signInSilently).not.toHaveBeenCalled();
    });

    it("silently renews a token nearing expiry", async () => {
      vi.mocked(getStoredAuth).mockResolvedValue({
        idToken: "t",
        expiresAt: Date.now() + 1000,
        user: { sub: "s", email: "e@x.com" },
        authorizationStatus: "authorized",
      });
      vi.mocked(signInSilently).mockResolvedValue({ sub: "s", email: "e@x.com" });

      await ensureFreshAuth();

      expect(signInSilently).toHaveBeenCalled();
      expect(authSignOut).not.toHaveBeenCalled();
    });

    it("falls back to requiring an interactive sign-in when silent renewal fails", async () => {
      vi.mocked(getStoredAuth).mockResolvedValue({
        idToken: "t",
        expiresAt: Date.now() - 1000,
        user: { sub: "s", email: "e@x.com" },
        authorizationStatus: "authorized",
      });
      vi.mocked(signInSilently).mockResolvedValue(null);

      await ensureFreshAuth();

      expect(authSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("side panel gated transcript requests", () => {
    let disconnect: () => void;

    function connectPanel(): void {
      let onDisconnect: () => void = () => {};
      connectListener({
        name: "sidepanel",
        onDisconnect: { addListener: (cb) => { onDisconnect = cb; } },
      });
      disconnect = () => onDisconnect();
    }

    beforeEach(() => {
      vi.mocked(chrome.tabs.query).mockReset().mockResolvedValue([{ id: 42 }] as never);
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(undefined);
      disconnect = () => {};
    });

    afterEach(() => {
      disconnect();
    });

    it("requests the active tab's transcript when the side panel connects", async () => {
      connectPanel();

      await vi.waitFor(() =>
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
          type: MessageType.REQUEST_TRANSCRIPT,
        })
      );
    });

    it("ignores connections that aren't the side panel port", () => {
      connectListener({ name: "something-else", onDisconnect: { addListener: vi.fn() } });
      expect(chrome.tabs.query).not.toHaveBeenCalled();
    });

    it("requests the newly active tab's transcript when switching tabs while the panel is open", async () => {
      connectPanel();
      await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockClear();

      activatedListener({ tabId: 99 });

      await vi.waitFor(() =>
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(99, {
          type: MessageType.REQUEST_TRANSCRIPT,
        })
      );
    });

    it("stops requesting on tab activation once the panel disconnects", async () => {
      connectPanel();
      await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockClear();

      disconnect();
      activatedListener({ tabId: 7 });

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it("does not request tabs on activation before the panel ever connects", () => {
      activatedListener({ tabId: 5 });
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it("re-requests the transcript when the active tab finishes a hard navigation", async () => {
      connectPanel();
      await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockClear();

      updatedListener(42, { status: "complete" }, { active: true });

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: MessageType.REQUEST_TRANSCRIPT,
      });
    });

    it("ignores navigation updates on inactive tabs", async () => {
      connectPanel();
      await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockClear();

      updatedListener(99, { status: "complete" }, { active: false });

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores in-progress navigation updates", async () => {
      connectPanel();
      await vi.waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
      (chrome.tabs.sendMessage as ReturnType<typeof vi.fn>).mockClear();

      updatedListener(42, { status: "loading" }, { active: true });

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores navigation updates while the panel is closed", () => {
      updatedListener(42, { status: "complete" }, { active: true });
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });
});
