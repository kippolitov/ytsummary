import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/savedVideosClient", () => ({
  getSavedVideo: vi.fn(),
  deleteSavedVideo: vi.fn(),
  saveVideo: vi.fn(),
}));
vi.mock("../../services/sessionCache", () => ({
  storeVideo: vi.fn(),
  setResult: vi.fn(),
}));
vi.mock("../../services/chatCache", () => ({
  saveChatSession: vi.fn(),
}));
vi.mock("../../components/KnowledgePanel/KnowledgePanel", () => ({
  KnowledgePanel: ({ videoTitle }: { videoTitle: string }) => (
    <div data-testid="knowledge-panel">summary:{videoTitle}</div>
  ),
}));
vi.mock("../../components/Chat/ChatPanel", () => ({
  ChatPanel: ({
    videoId,
    onMessagesUpdated,
  }: {
    videoId: string;
    onMessagesUpdated?: (messages: unknown[]) => void;
  }) => (
    <div data-testid="chat-panel">
      chat:{videoId}
      <button onClick={() => onMessagesUpdated?.([{ id: "new" }])}>simulate new message</button>
    </div>
  ),
}));

import { SavedVideoDetail } from "../../components/Saved/SavedVideoDetail";
import { getSavedVideo, deleteSavedVideo, saveVideo } from "../../services/savedVideosClient";
import { storeVideo, setResult } from "../../services/sessionCache";
import { saveChatSession } from "../../services/chatCache";
import type { SavedVideoDetail as SavedVideoDetailData } from "../../types/index";

const detail: SavedVideoDetailData = {
  videoId: "abc12345678",
  videoTitle: "Restored video",
  channelName: "Chan",
  videoUrl: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 300,
  summary: { videoId: "abc12345678", tldr: ["x"], topics: [], steps: [], references: [], analyzedAt: "2026-01-01T00:00:00.000Z" },
  messages: [{ id: "m1", role: "user", content: "hi", type: "chat", timestamp: 1 }],
  savedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SavedVideoDetail", () => {
  beforeEach(() => {
    vi.mocked(getSavedVideo).mockReset();
    vi.mocked(deleteSavedVideo).mockReset().mockResolvedValue(undefined);
    vi.mocked(saveVideo).mockReset();
    vi.mocked(storeVideo).mockReset().mockResolvedValue(undefined);
    vi.mocked(setResult).mockReset().mockResolvedValue(undefined);
    vi.mocked(saveChatSession).mockReset().mockResolvedValue(undefined);
  });

  it("always fetches fresh from the backend on open (US4) and restores summary + chat", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue(detail);

    render(<SavedVideoDetail videoId="abc12345678" onBack={vi.fn()} onUnsaved={vi.fn()} />);

    expect(await screen.findByTestId("knowledge-panel")).toHaveTextContent("Restored video");
    expect(getSavedVideo).toHaveBeenCalledWith("abc12345678");
    expect(storeVideo).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "abc12345678", title: "Restored video" })
    );
    expect(setResult).toHaveBeenCalledWith("abc12345678", detail.summary);
    expect(saveChatSession).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "abc12345678", messages: detail.messages })
    );
  });

  it("shows a not-found message when nothing is saved for this videoId", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue(null);

    render(<SavedVideoDetail videoId="abc12345678" onBack={vi.fn()} onUnsaved={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be found");
  });

  it("shows an error message when loading fails", async () => {
    vi.mocked(getSavedVideo).mockRejectedValue(new Error("boom"));

    render(<SavedVideoDetail videoId="abc12345678" onBack={vi.fn()} onUnsaved={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this saved video");
  });

  it("calls onBack when the back control is clicked", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue(detail);
    const onBack = vi.fn();

    render(<SavedVideoDetail videoId="abc12345678" onBack={onBack} onUnsaved={vi.fn()} />);
    await screen.findByTestId("knowledge-panel");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Back to saved videos" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("unsaves the video and calls onUnsaved", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue(detail);
    const onUnsaved = vi.fn();

    render(<SavedVideoDetail videoId="abc12345678" onBack={vi.fn()} onUnsaved={onUnsaved} />);
    await screen.findByTestId("knowledge-panel");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove from saved videos" }));

    expect(deleteSavedVideo).toHaveBeenCalledWith("abc12345678");
    expect(onUnsaved).toHaveBeenCalledTimes(1);
  });

  it("re-saves (re-PUTs) the full saved video when the chat panel reports new messages (FR-015)", async () => {
    vi.mocked(getSavedVideo).mockResolvedValue(detail);
    vi.mocked(saveVideo).mockResolvedValue(detail);

    render(<SavedVideoDetail videoId="abc12345678" onBack={vi.fn()} onUnsaved={vi.fn()} />);
    await screen.findByTestId("knowledge-panel");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Chat" }));
    await user.click(screen.getByText("simulate new message"));

    expect(saveVideo).toHaveBeenCalledWith("abc12345678", {
      videoTitle: detail.videoTitle,
      channelName: detail.channelName,
      videoUrl: detail.videoUrl,
      durationSeconds: detail.durationSeconds,
      summary: detail.summary,
      messages: [{ id: "new" }],
    });
  });
});
