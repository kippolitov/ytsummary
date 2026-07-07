import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../components/Saved/SaveButton", () => ({
  SaveButton: ({ videoId }: { videoId: string }) => (
    <button aria-label="Save video" data-testid={`save-${videoId}`}>
      Save
    </button>
  ),
}));

import { KnowledgePanel } from "../../components/KnowledgePanel/KnowledgePanel";
import type { AnalysisResult } from "../../types/index";

const result: AnalysisResult = {
  videoId: "abc12345678",
  tldr: ["First takeaway.", "Second takeaway."],
  topics: [{ name: "Topic A", description: "Description A.", timestampSeconds: null }],
  steps: [{ order: 1, text: "Install the tool.", timestampSeconds: null }],
  references: [
    { name: "Some Library", description: "A library.", url: "https://example.com", context: "Mentioned" },
  ],
  analyzedAt: "2026-06-10T10:00:00Z",
};

describe("KnowledgePanel", () => {
  it("renders all sections from the analysis result", () => {
    render(<KnowledgePanel result={result} />);
    expect(screen.getByText("First takeaway.")).toBeInTheDocument();
    expect(screen.getByText("Topic A")).toBeInTheDocument();
    expect(screen.getByText("Install the tool.")).toBeInTheDocument();
    expect(screen.getByText("Some Library")).toBeInTheDocument();
  });

  it("renders no header when title and channel are absent", () => {
    render(<KnowledgePanel result={result} />);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("renders the video title when provided", () => {
    render(<KnowledgePanel result={result} videoTitle="My Video" />);
    expect(screen.getByRole("heading", { name: "My Video" })).toBeInTheDocument();
  });

  it("renders the channel name when provided", () => {
    render(<KnowledgePanel result={result} channelName="My Channel" />);
    expect(screen.getByText("My Channel")).toBeInTheDocument();
  });

  it("renders both title and channel together", () => {
    render(<KnowledgePanel result={result} videoTitle="My Video" channelName="My Channel" />);
    expect(screen.getByRole("heading", { name: "My Video" })).toBeInTheDocument();
    expect(screen.getByText("My Channel")).toBeInTheDocument();
  });
});
