import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlogPostButton } from "../../components/Chat/BlogPostButton";

describe("BlogPostButton", () => {
  it("renders the generate button", () => {
    render(<BlogPostButton onGenerate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Generate blog post from this video" })
    ).toBeInTheDocument();
    expect(screen.getByText("Generate Blog Post")).toBeInTheDocument();
  });

  it("calls onGenerate when clicked", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<BlogPostButton onGenerate={onGenerate} />);

    await user.click(screen.getByRole("button"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("does not call onGenerate when disabled", async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<BlogPostButton onGenerate={onGenerate} disabled />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button).catch(() => {});
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
