import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/savedVideosClient", () => ({
  listSavedVideos: vi.fn(),
}));

import { SavedList } from "../../components/Saved/SavedList";
import { listSavedVideos } from "../../services/savedVideosClient";
import type { SavedVideoSummary } from "../../types/index";

const videos: SavedVideoSummary[] = [
  {
    videoId: "abc12345678",
    videoTitle: "First saved video",
    channelName: "Channel A",
    videoUrl: "https://youtube.com/watch?v=abc12345678",
    durationSeconds: 300,
    savedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    videoId: "dQw4w9WgXcQ",
    videoTitle: "Second saved video",
    channelName: "Channel B",
    videoUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
    durationSeconds: 200,
    savedAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("SavedList", () => {
  beforeEach(() => {
    vi.mocked(listSavedVideos).mockReset();
  });

  it("shows the empty state when there are no saved videos (FR-017)", async () => {
    vi.mocked(listSavedVideos).mockResolvedValue([]);

    render(<SavedList onSelect={vi.fn()} />);

    expect(await screen.findByText("No saved videos yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    vi.mocked(listSavedVideos).mockRejectedValue(new Error("network down"));

    render(<SavedList onSelect={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your saved videos.");
  });

  it("renders one entry per saved video with identifying info (FR-012)", async () => {
    vi.mocked(listSavedVideos).mockResolvedValue(videos);

    render(<SavedList onSelect={vi.fn()} />);

    expect(await screen.findByText("First saved video")).toBeInTheDocument();
    expect(screen.getByText("Channel A")).toBeInTheDocument();
    expect(screen.getByText("Second saved video")).toBeInTheDocument();
    expect(screen.getByText("Channel B")).toBeInTheDocument();
  });

  it("calls onSelect with the videoId when an entry is clicked", async () => {
    vi.mocked(listSavedVideos).mockResolvedValue(videos);
    const onSelect = vi.fn();

    render(<SavedList onSelect={onSelect} />);
    await screen.findByText("First saved video");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open saved video: First saved video" }));

    expect(onSelect).toHaveBeenCalledWith("abc12345678");
  });
});
