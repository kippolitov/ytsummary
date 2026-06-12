import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChatSession } from "../../types/chat";
import type { Video } from "../../types/index";

vi.mock("../../services/chatCache", () => ({
  getChatSession: vi.fn(),
  saveChatSession: vi.fn(),
}));
vi.mock("../../services/sessionCache", () => ({
  getVideo: vi.fn(),
}));
vi.mock("../../services/chatClient", () => ({
  sendChatMessage: vi.fn(),
}));
vi.mock("../../services/followUpClient", () => ({
  fetchFollowUpPrompts: vi.fn(),
}));

import { ChatPanel } from "../../components/Chat/ChatPanel";
import { getChatSession, saveChatSession } from "../../services/chatCache";
import { getVideo } from "../../services/sessionCache";
import { sendChatMessage } from "../../services/chatClient";
import { fetchFollowUpPrompts } from "../../services/followUpClient";

const video: Video = {
  videoId: "abc12345678",
  title: "Test Video",
  channelName: "Test Channel",
  url: "https://youtube.com/watch?v=abc12345678",
  durationSeconds: 600,
  transcript: "Full transcript text.",
};

const cachedSession: ChatSession = {
  videoId: video.videoId,
  messages: [
    { id: "m1", role: "user", content: "Earlier question", type: "chat", timestamp: 1 },
    { id: "m2", role: "assistant", content: "Earlier answer", type: "chat", timestamp: 2 },
  ],
  createdAt: 1,
  updatedAt: 2,
};

function mockStream(...chunks: string[]) {
  vi.mocked(sendChatMessage).mockImplementation(async function* () {
    for (const c of chunks) yield c;
  });
}

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getChatSession).mockResolvedValue(null);
    vi.mocked(saveChatSession).mockResolvedValue(undefined);
    vi.mocked(getVideo).mockResolvedValue(video);
    vi.mocked(fetchFollowUpPrompts).mockResolvedValue([]);
    mockStream("Hello", " world");
  });

  it("shows the unavailable state when the video has no transcript", async () => {
    vi.mocked(getVideo).mockResolvedValue(null);
    render(<ChatPanel videoId="abc12345678" />);
    expect(await screen.findByText("Chat is unavailable")).toBeInTheDocument();
  });

  it("shows the empty state when there are no messages", async () => {
    render(<ChatPanel videoId="abc12345678" />);
    expect(await screen.findByText("Ask anything about this video")).toBeInTheDocument();
  });

  it("restores cached messages from the chat session", async () => {
    vi.mocked(getChatSession).mockResolvedValue(cachedSession);
    render(<ChatPanel videoId="abc12345678" />);
    expect(await screen.findByText("Earlier question")).toBeInTheDocument();
    expect(await screen.findByText("Earlier answer")).toBeInTheDocument();
  });

  it("sends a message, streams the reply, and persists the session", async () => {
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "What is this?{Enter}");

    expect(await screen.findByText("What is this?")).toBeInTheDocument();
    expect(await screen.findByText("Hello world")).toBeInTheDocument();

    await waitFor(() => expect(saveChatSession).toHaveBeenCalled());
    const saved = vi.mocked(saveChatSession).mock.calls[0]![0];
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[1]).toMatchObject({ role: "assistant", content: "Hello world" });

    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: video.videoId,
        videoTitle: video.title,
        transcript: video.transcript,
        mode: "chat",
      })
    );
  });

  it("fetches and renders follow-up prompt chips after a chat reply", async () => {
    vi.mocked(fetchFollowUpPrompts).mockResolvedValue([
      "Deeper question?",
      "Another angle?",
      "Next step?",
    ]);
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "Q{Enter}");

    expect(await screen.findByText("Deeper question?")).toBeInTheDocument();
    expect(screen.getByText("Another angle?")).toBeInTheDocument();
    expect(fetchFollowUpPrompts).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "follow-up-prompts" })
    );
  });

  it("submits a follow-up prompt as the next user message when its chip is clicked", async () => {
    vi.mocked(fetchFollowUpPrompts)
      .mockResolvedValueOnce(["Deeper question?"])
      .mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "Q{Enter}");
    const chip = await screen.findByRole("button", { name: "Deeper question?" });
    await user.click(chip);

    expect(await screen.findByText("Deeper question?")).toBeInTheDocument();
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(2));
    const secondCall = vi.mocked(sendChatMessage).mock.calls[1]![0];
    expect(secondCall.messages.at(-1)).toMatchObject({ content: "Deeper question?" });
  });

  it("generates a blog post without fetching follow-up prompts", async () => {
    mockStream("# Blog Title", "\n\nBody text.");
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.click(screen.getByRole("button", { name: "Generate blog post from this video" }));

    expect(await screen.findByText("Generate Blog Post", { selector: "div" })).toBeInTheDocument();
    expect(await screen.findByText("Blog Title")).toBeInTheDocument();

    await waitFor(() => expect(saveChatSession).toHaveBeenCalled());
    expect(fetchFollowUpPrompts).not.toHaveBeenCalled();
    expect(sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({ mode: "blog-post" }));
  });

  it("shows a dismissible error when the stream fails", async () => {
    vi.mocked(sendChatMessage).mockImplementation(async function* () {
      yield "";
      throw { code: "service-error", message: "The chat service encountered an error.", action: "Try again.", retryable: true };
    });
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "Q{Enter}");

    expect(await screen.findByText("The chat service encountered an error.")).toBeInTheDocument();
    expect(saveChatSession).not.toHaveBeenCalled();
    expect(fetchFollowUpPrompts).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("The chat service encountered an error.")).not.toBeInTheDocument();
  });

  it("falls back to a generic error message when the failure has none", async () => {
    vi.mocked(sendChatMessage).mockImplementation(async function* () {
      yield "";
      throw {};
    });
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "Q{Enter}");
    expect(
      await screen.findByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
  });

  it("disables input while streaming", async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    vi.mocked(sendChatMessage).mockImplementation(async function* () {
      yield "partial";
      await gate;
    });
    const user = userEvent.setup();
    render(<ChatPanel videoId="abc12345678" />);
    await screen.findByText("Ask anything about this video");

    await user.type(screen.getByLabelText("Chat message input"), "Q{Enter}");

    await waitFor(() =>
      expect(screen.getByLabelText("Chat message input")).toBeDisabled()
    );
    expect(
      screen.getByRole("button", { name: "Generate blog post from this video" })
    ).toBeDisabled();

    release();
    await waitFor(() =>
      expect(screen.getByLabelText("Chat message input")).not.toBeDisabled()
    );
  });
});
