import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { ChatMessageBubble } from "../../components/Chat/ChatMessageBubble";
import type { ChatMessage } from "../../types/chat";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "test-id",
    role: "assistant",
    content: "Hello world",
    type: "chat",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ChatMessageBubble — GFM rendering", () => {
  it("renders a GFM table as an HTML table element", () => {
    const msg = makeMessage({
      content: "| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("th")).not.toBeNull();
    expect(container.querySelector("td")).not.toBeNull();
  });

  it("renders a fenced code block with a language- class", () => {
    const msg = makeMessage({
      content: "```typescript\nconst x = 1;\n```",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    const codeEl = container.querySelector("code");
    expect(codeEl).not.toBeNull();
    const className = codeEl?.className ?? "";
    expect(className).toMatch(/language-/);
  });

  it("renders a hyperlink with target=_blank and rel=noopener noreferrer", () => {
    const msg = makeMessage({
      content: "[Visit site](https://example.com)",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders markdown headings as heading elements", () => {
    const msg = makeMessage({
      content: "## Section Title\n\nSome text.",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("renders bold text as strong element", () => {
    const msg = makeMessage({
      content: "This is **bold** text.",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    expect(container.querySelector("strong")).not.toBeNull();
  });

  it("renders user messages as plain text without markdown processing", () => {
    const msg = makeMessage({
      role: "user",
      content: "| Col1 | Col2 |\n|------|------|\n| A | B |",
    });
    const { container } = render(<ChatMessageBubble message={msg} />);
    // User messages render plain text, no table
    expect(container.querySelector("table")).toBeNull();
  });

  it("renders the streaming cursor when isStreaming is true", () => {
    const msg = makeMessage({ content: "Partial response..." });
    render(<ChatMessageBubble message={msg} isStreaming={true} />);
    const cursor = screen.getByLabelText("Generating response");
    expect(cursor).toBeTruthy();
  });

  it("does not render the streaming cursor when isStreaming is false", () => {
    const msg = makeMessage({ content: "Full response." });
    render(<ChatMessageBubble message={msg} isStreaming={false} />);
    expect(screen.queryByLabelText("Generating response")).toBeNull();
  });

  it("renders a Copy button for blog-post messages when not streaming", () => {
    const msg = makeMessage({ type: "blog-post", role: "assistant" });
    render(<ChatMessageBubble message={msg} />);
    expect(screen.getByLabelText("Copy blog post to clipboard")).toBeTruthy();
  });

  it("does not render a Copy button for chat messages", () => {
    const msg = makeMessage({ type: "chat", role: "assistant" });
    render(<ChatMessageBubble message={msg} />);
    expect(screen.queryByLabelText("Copy blog post to clipboard")).toBeNull();
  });

  it("does not render a Copy button while streaming", () => {
    const msg = makeMessage({ type: "blog-post", role: "assistant" });
    render(<ChatMessageBubble message={msg} isStreaming={true} />);
    expect(screen.queryByLabelText("Copy blog post to clipboard")).toBeNull();
  });

  it("Copy button shows Copied! after click when clipboard write succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const msg = makeMessage({ type: "blog-post", content: "Blog content.", role: "assistant" });
    render(<ChatMessageBubble message={msg} />);

    const btn = screen.getByLabelText("Copy blog post to clipboard");
    await userEvent.click(btn);

    expect(writeText).toHaveBeenCalledWith("Blog content.");
    expect(screen.getByText("Copied!")).toBeTruthy();
  });
});
