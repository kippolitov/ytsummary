import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummarySection } from "../../components/sections/SummarySection";

describe("SummarySection", () => {
  it("renders nothing when tldr is empty", () => {
    const { container } = render(<SummarySection tldr={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a single <li> for a one-item tldr array", () => {
    render(<SummarySection tldr={["One bullet."]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
  });

  it("renders one <li> per bullet for a multi-item tldr array", () => {
    render(<SummarySection tldr={["Bullet one.", "Bullet two.", "Bullet three."]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("the <ul> carries aria-label 'Key takeaways'", () => {
    render(<SummarySection tldr={["Any bullet."]} />);
    expect(screen.getByRole("list", { name: "Key takeaways" })).toBeInTheDocument();
  });
});
