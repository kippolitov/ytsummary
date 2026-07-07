import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageType } from "../../types/messages";
import type { ExtensionMessage } from "../../types/messages";
import type { AnalysisResult, PanelError, Video } from "../../types/index";

vi.mock("../../services/sessionCache", () => ({
  getLastVideo: vi.fn(),
  getResult: vi.fn(),
}));
vi.mock("../../components/Chat/ChatPanel", () => ({
  ChatPanel: ({ videoId }: { videoId: string }) => (
    <div data-testid="chat-panel">chat:{videoId}</div>
  ),
}));
vi.mock("../../components/Saved/SavedList", () => ({
  SavedList: () => <div data-testid="saved-list">saved list</div>,
}));
vi.mock("../../components/Saved/SavedVideoDetail", () => ({
  SavedVideoDetail: ({ videoId }: { videoId: string }) => (
    <div data-testid="saved-video-detail">saved detail:{videoId}</div>
  ),
}));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { App } from "../../entrypoints/sidepanel/App";
import { getLastVideo, getResult } from "../../services/sessionCache";
import { useAuth } from "../../hooks/useAuth";

const result: AnalysisResult = {
  videoId: "abc12345678",
  tldr: ["Key takeaway sentence."],
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-06-10T10:00:00Z",
};

const retryableError: PanelError = {
  code: "service-error",
  message: "The analysis service encountered an error.",
  action: "Try again.",
  retryable: true,
};

function getRegisteredListener(): (message: ExtensionMessage) => void {
  const addListener = chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>;
  const call = addListener.mock.calls.at(-1);
  if (!call) throw new Error("onMessage listener was not registered");
  return call[0] as (message: ExtensionMessage) => void;
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getLastVideo).mockResolvedValue(null);
    vi.mocked(getResult).mockResolvedValue(null);
    vi.mocked(useAuth).mockReturnValue({
      status: "signed-in",
      user: { sub: "123", email: "user@example.com" },
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it("renders the idle state when no video has been visited", async () => {
    render(<App />);
    expect(await screen.findByText("Open a YouTube video")).toBeInTheDocument();
  });

  it("hydrates into the ready state from the session cache", async () => {
    vi.mocked(getLastVideo).mockResolvedValue({
      videoId: "abc12345678",
      title: "Cached Video",
      channelName: "Cached Channel",
    });
    vi.mocked(getResult).mockResolvedValue(result);

    render(<App />);
    expect(await screen.findByText("Key takeaway sentence.")).toBeInTheDocument();
    expect(screen.getByText("Cached Channel")).toBeInTheDocument();
  });

  it("hydrates into the loading state when the last video has no cached result", async () => {
    vi.mocked(getLastVideo).mockResolvedValue({
      videoId: "abc12345678",
      title: "Pending Video",
      channelName: "Channel",
    });

    render(<App />);
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("renders the analysis result when an ANALYSIS_RESULT message arrives", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    act(() => {
      getRegisteredListener()({ type: MessageType.ANALYSIS_RESULT, result });
    });
    expect(await screen.findByText("Key takeaway sentence.")).toBeInTheDocument();
  });

  it("renders a retryable error with a retry button", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    act(() => {
      getRegisteredListener()({
        type: MessageType.ANALYSIS_RESULT,
        result,
      });
      getRegisteredListener()({
        type: MessageType.ANALYSIS_ERROR,
        error: retryableError,
      });
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry analysis" }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MessageType.RETRY_ANALYSIS,
      videoId: result.videoId,
    });
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("renders the no-captions state for a non-retryable unknown error", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    act(() => {
      getRegisteredListener()({
        type: MessageType.ANALYSIS_ERROR,
        error: { code: "unknown", message: "No captions.", action: "Try another.", retryable: false },
      });
    });
    expect(await screen.findByText("No captions available")).toBeInTheDocument();
  });

  it("resets to loading and clears the title on VIDEO_CHANGED", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const video: Video = {
      videoId: "abc12345678",
      title: "A Video Title",
      channelName: "Channel",
      url: "",
      durationSeconds: 0,
      transcript: "t",
    };

    act(() => {
      getRegisteredListener()({ type: MessageType.TRANSCRIPT_READY, video });
    });
    expect(await screen.findByText("A Video Title")).toBeInTheDocument();

    act(() => {
      getRegisteredListener()({ type: MessageType.VIDEO_CHANGED, videoId: "zzz99999999" });
    });
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("A Video Title")).not.toBeInTheDocument();
    expect(screen.getByText("YouTube AI")).toBeInTheDocument();
  });

  it("truncates long video titles in the header", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const longTitle = "T".repeat(50);
    act(() => {
      getRegisteredListener()({
        type: MessageType.TRANSCRIPT_READY,
        video: { videoId: "abc12345678", title: longTitle, channelName: "C", url: "", durationSeconds: 0, transcript: "t" },
      });
    });
    expect(await screen.findByText("T".repeat(38) + "…")).toBeInTheDocument();
  });

  it("ignores retry when no video is active", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Refresh summary" }));
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("switches to the chat tab and renders the chat panel", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Chat" }));

    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.queryByText("Open a YouTube video")).not.toBeInTheDocument();
  });

  it("cycles the theme preference on the theme button", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const user = userEvent.setup();
    const themeButton = screen.getByRole("button", { name: /Current theme: system/ });
    await user.click(themeButton);

    expect(screen.getByRole("button", { name: /Current theme: light/ })).toBeInTheDocument();
    expect(localStorage.getItem("theme-preference")).toBe("light");

    await user.click(screen.getByRole("button", { name: /Current theme: light/ }));
    expect(screen.getByRole("button", { name: /Current theme: dark/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Current theme: dark/ }));
    expect(screen.getByRole("button", { name: /Current theme: system/ })).toBeInTheDocument();
  });

  it("removes the message listener on unmount", async () => {
    const { unmount } = render(<App />);
    await screen.findByText("Open a YouTube video");
    unmount();
    await waitFor(() =>
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled()
    );
  });

  it("hides Summary/Chat and shows the sign-in prompt when signed out", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "signed-out",
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(<App />);

    expect(await screen.findByText("Sign in with Google to use this extension")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows a sign-out control when signed in and calls signOut on click", async () => {
    const signOut = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: "signed-in",
      user: { sub: "123", email: "user@example.com" },
      signIn: vi.fn(),
      signOut,
    });

    render(<App />);
    await screen.findByText("Open a YouTube video");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("connects a sidepanel port on mount and disconnects it on unmount", async () => {
    const { unmount } = render(<App />);
    await screen.findByText("Open a YouTube video");

    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: "sidepanel" });
    const port = (chrome.runtime.connect as ReturnType<typeof vi.fn>).mock.results.at(-1)!.value;

    unmount();
    expect(port.disconnect).toHaveBeenCalled();
  });

  it("switches to the Saved tab and shows the saved list", async () => {
    render(<App />);
    await screen.findByText("Open a YouTube video");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Saved" }));

    expect(screen.getByTestId("saved-list")).toBeInTheDocument();
    expect(screen.queryByText("Open a YouTube video")).not.toBeInTheDocument();
  });
});
