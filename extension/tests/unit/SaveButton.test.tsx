import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/sessionCache", () => ({
  getVideo: vi.fn(),
  getResult: vi.fn(),
}));
vi.mock("../../services/chatCache", () => ({
  getChatSession: vi.fn(),
}));
vi.mock("../../services/savedVideosClient", () => ({
  saveVideo: vi.fn(),
  getSavedVideo: vi.fn(),
}));

import { SaveButton } from "../../components/Saved/SaveButton";
import { getVideo, getResult } from "../../services/sessionCache";
import { getChatSession } from "../../services/chatCache";
import { saveVideo, getSavedVideo } from "../../services/savedVideosClient";
import type { AnalysisResult, Video } from "../../types/index";
import type { ChatSession } from "../../types/chat";

const video: Video = {
  videoId: "abc12345678",
  title: "Test Video",
  channelName: "Test Channel",
  url: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 600,
  transcript: "transcript",
};

const summary: AnalysisResult = {
  videoId: "abc12345678",
  tldr: ["A takeaway."],
  topics: [],
  steps: [],
  references: [],
  analyzedAt: "2026-01-01T00:00:00.000Z",
};

const session: ChatSession = {
  videoId: "abc12345678",
  messages: [{ id: "m1", role: "user", content: "hi", type: "chat", timestamp: 1 }],
  createdAt: 1,
  updatedAt: 1,
};

describe("SaveButton", () => {
  beforeEach(() => {
    vi.mocked(getVideo).mockReset().mockResolvedValue(video);
    vi.mocked(getResult).mockReset().mockResolvedValue(summary);
    vi.mocked(getChatSession).mockReset().mockResolvedValue(session);
    vi.mocked(saveVideo).mockReset();
    vi.mocked(getSavedVideo).mockReset().mockResolvedValue(null);
  });

  it("does not issue a save request merely from being rendered/viewed (SC-006)", async () => {
    render(<SaveButton videoId="abc12345678" />);
    await screen.findByRole("button", { name: "Save video" });
    expect(saveVideo).not.toHaveBeenCalled();
  });

  it("shows the saved state on mount when the video is already saved (FR-016)", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue({
      videoId: "abc12345678",
      videoTitle: video.title,
      channelName: video.channelName,
      videoUrl: video.url,
      durationSeconds: video.durationSeconds,
      summary,
      messages: session.messages,
      savedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    render(<SaveButton videoId="abc12345678" />);

    expect(await screen.findByRole("button", { name: "Video saved" })).toBeInTheDocument();
  });

  it("saves on explicit click and transitions idle -> saving -> saved", async () => {
    let resolveSave!: (value: unknown) => void;
    vi.mocked(saveVideo).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }) as ReturnType<typeof saveVideo>
    );

    render(<SaveButton videoId="abc12345678" />);
    const button = await screen.findByRole("button", { name: "Save video" });

    const user = userEvent.setup();
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Saving video" })).toBeInTheDocument();
    expect(saveVideo).toHaveBeenCalledWith("abc12345678", {
      videoTitle: video.title,
      channelName: video.channelName,
      videoUrl: video.url,
      durationSeconds: video.durationSeconds,
      summary,
      messages: session.messages,
    });

    resolveSave({
      videoId: "abc12345678",
      videoTitle: video.title,
      channelName: video.channelName,
      videoUrl: video.url,
      durationSeconds: video.durationSeconds,
      summary,
      messages: session.messages,
      savedAt: "now",
      updatedAt: "now",
    });

    expect(await screen.findByRole("button", { name: "Video saved" })).toBeInTheDocument();
  });

  it("shows a non-blocking error message when the save fails", async () => {
    vi.mocked(saveVideo).mockRejectedValue({ code: "service-error", message: "Save did not complete." });

    render(<SaveButton videoId="abc12345678" />);
    const button = await screen.findByRole("button", { name: "Save video" });

    const user = userEvent.setup();
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("Save did not complete.");
    // still shows the (retryable) Save button, not stuck saving forever
    expect(screen.getByRole("button", { name: "Save video" })).toBeInTheDocument();
  });

  it("shows a specific message and does not clear to idle when the 200-video limit is reached", async () => {
    vi.mocked(saveVideo).mockRejectedValue({
      code: "saved-video-limit-reached",
      message: "remove a saved video before saving another",
    });

    render(<SaveButton videoId="abc12345678" />);
    const button = await screen.findByRole("button", { name: "Save video" });

    const user = userEvent.setup();
    await user.click(button);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/remove a saved video/i)
    );
  });
});
