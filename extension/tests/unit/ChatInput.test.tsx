import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "../../components/Chat/ChatInput";

describe("ChatInput", () => {
  it("renders textarea and send button", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Chat message input")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("submits trimmed text via the send button and clears the input", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Chat message input");
    await user.type(textarea, "  hello there  ");
    await user.click(screen.getByLabelText("Send message"));

    expect(onSubmit).toHaveBeenCalledWith("hello there");
    expect(textarea).toHaveValue("");
  });

  it("submits on Enter without Shift", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Chat message input"), "question{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("question");
  });

  it("does not submit on Shift+Enter (newline instead)", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Chat message input"), "line1{Shift>}{Enter}{/Shift}line2");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit empty or whitespace-only input", async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Chat message input");
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("disables textarea and button when disabled", () => {
    render(<ChatInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByLabelText("Chat message input")).toBeDisabled();
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("ignores submit attempts while disabled", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<ChatInput onSubmit={onSubmit} />);
    const textarea = screen.getByLabelText("Chat message input");
    fireEvent.change(textarea, { target: { value: "pending question" } });

    rerender(<ChatInput onSubmit={onSubmit} disabled />);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills the input when prefill prop is provided", () => {
    const { rerender } = render(<ChatInput onSubmit={vi.fn()} />);
    rerender(<ChatInput onSubmit={vi.fn()} prefill="Suggested question?" />);
    expect(screen.getByLabelText("Chat message input")).toHaveValue("Suggested question?");
  });

  it("shows no character counter for short input", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Chat message input"), {
      target: { value: "short" },
    });
    expect(screen.queryByText(/^-?\d+$/)).not.toBeInTheDocument();
  });

  it("shows remaining characters when fewer than 200 remain", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Chat message input"), {
      target: { value: "x".repeat(1850) },
    });
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("shows amber counter when fewer than 100 remain", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Chat message input"), {
      target: { value: "x".repeat(1950) },
    });
    const counter = screen.getByText("50");
    expect(counter.className).toContain("amber");
  });

  it("disables send and shows red counter when over the limit", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Chat message input"), {
      target: { value: "x".repeat(2005) },
    });
    const counter = screen.getByText("-5");
    expect(counter.className).toContain("red");
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("caps input at MAX_CHARS + 10 characters", () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    const textarea = screen.getByLabelText("Chat message input");
    fireEvent.change(textarea, { target: { value: "x".repeat(5000) } });
    expect((textarea as HTMLTextAreaElement).value.length).toBe(2010);
  });
});
