import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalloutBlock } from "../../components/Chat/markdown/CalloutBlock";

function renderCallout(text: string) {
  return render(
    <CalloutBlock>
      <p><strong>{text.split(": ")[0]!.replace(/\*\*/g, "")}</strong>: {text.split(": ").slice(1).join(": ")}</p>
    </CalloutBlock>
  );
}

describe("CalloutBlock", () => {
  it("renders Key Insight as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Key Insight</strong>: This is the main point.</p>
      </CalloutBlock>
    );
    const callout = container.querySelector("[data-callout]");
    expect(callout).not.toBeNull();
  });

  it("renders Important as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Important</strong>: Pay attention here.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("[data-callout]")).not.toBeNull();
  });

  it("renders Tip as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Tip</strong>: Use this shortcut.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("[data-callout]")).not.toBeNull();
  });

  it("renders Warning as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Warning</strong>: Be careful.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("[data-callout]")).not.toBeNull();
  });

  it("renders Note as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Note</strong>: Worth remembering.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("[data-callout]")).not.toBeNull();
  });

  it("renders Example as a styled callout div", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Example</strong>: Here is one.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("[data-callout]")).not.toBeNull();
  });

  it("falls back to a standard blockquote for non-matching content", () => {
    const { container } = render(
      <CalloutBlock>
        <p>Just a regular quote without a special label.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("[data-callout]")).toBeNull();
  });

  it("falls back to a standard blockquote when bold label is not in the known set", () => {
    const { container } = render(
      <CalloutBlock>
        <p><strong>Random</strong>: This does not match any callout label.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("[data-callout]")).toBeNull();
  });

  it("renders the callout label text visibly", () => {
    render(
      <CalloutBlock>
        <p><strong>Key Insight</strong>: Some insight text.</p>
      </CalloutBlock>
    );
    expect(screen.getByText("Key Insight")).toBeTruthy();
  });

  it("renders callout content text visibly", () => {
    render(
      <CalloutBlock>
        <p><strong>Tip</strong>: Remember to save your work.</p>
      </CalloutBlock>
    );
    expect(screen.getByText(/Remember to save your work/)).toBeTruthy();
  });

  it("falls back to a standard blockquote when children is undefined", () => {
    const { container } = render(<CalloutBlock />);
    expect(container.querySelector("blockquote")).not.toBeNull();
  });

  it("falls back to a standard blockquote when children is a plain string (no elements)", () => {
    const { container } = render(
      <CalloutBlock>{"Just plain text, no elements."}</CalloutBlock>
    );
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("[data-callout]")).toBeNull();
  });

  it("falls back when first child p has no strong element (text-only paragraph)", () => {
    const { container } = render(
      <CalloutBlock>
        <p>No bold prefix here.</p>
      </CalloutBlock>
    );
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("[data-callout]")).toBeNull();
  });
});
