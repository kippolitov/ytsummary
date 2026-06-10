import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUpPromptChips } from "../../components/Chat/FollowUpPromptChips";

const SAMPLE_PROMPTS = [
  "What is the main argument?",
  "How does this compare to alternatives?",
  "What action should I take?",
];

describe("FollowUpPromptChips", () => {
  it("renders three chip buttons with the prompt text", () => {
    render(
      <FollowUpPromptChips
        prompts={SAMPLE_PROMPTS}
        isLoading={false}
        onSelect={vi.fn()}
      />
    );

    for (const prompt of SAMPLE_PROMPTS) {
      expect(screen.getByText(prompt)).toBeTruthy();
    }
  });

  it("calls onSelect with the correct string when first chip is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPromptChips
        prompts={SAMPLE_PROMPTS}
        isLoading={false}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByText(SAMPLE_PROMPTS[0]!));
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_PROMPTS[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect with the correct string when second chip is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPromptChips
        prompts={SAMPLE_PROMPTS}
        isLoading={false}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByText(SAMPLE_PROMPTS[1]!));
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_PROMPTS[1]);
  });

  it("renders three skeleton placeholders when isLoading is true", () => {
    const { container } = render(
      <FollowUpPromptChips
        prompts={[]}
        isLoading={true}
        onSelect={vi.fn()}
      />
    );

    const skeletons = container.querySelectorAll("[data-skeleton]");
    expect(skeletons).toHaveLength(3);
  });

  it("does not render chip text when isLoading is true", () => {
    render(
      <FollowUpPromptChips
        prompts={SAMPLE_PROMPTS}
        isLoading={true}
        onSelect={vi.fn()}
      />
    );

    for (const prompt of SAMPLE_PROMPTS) {
      expect(screen.queryByText(prompt)).toBeNull();
    }
  });

  it("renders nothing when prompts is empty and not loading", () => {
    const { container } = render(
      <FollowUpPromptChips
        prompts={[]}
        isLoading={false}
        onSelect={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
