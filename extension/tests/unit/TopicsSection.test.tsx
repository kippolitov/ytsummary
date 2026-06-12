import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopicsSection } from "../../components/sections/TopicsSection";
import type { Topic } from "../../types/index";

const topics: Topic[] = [
  { name: "Gradient Descent", description: "How models learn.", timestampSeconds: null },
  { name: "Backpropagation", description: "Computing gradients.", timestampSeconds: 120 },
];

describe("TopicsSection", () => {
  it("renders nothing when topics array is empty", () => {
    const { container } = render(<TopicsSection topics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the section heading", () => {
    render(<TopicsSection topics={topics} />);
    expect(screen.getByRole("heading", { name: "Topics" })).toBeInTheDocument();
  });

  it("renders each topic name and description", () => {
    render(<TopicsSection topics={topics} />);
    expect(screen.getByText("Gradient Descent")).toBeInTheDocument();
    expect(screen.getByText("How models learn.")).toBeInTheDocument();
    expect(screen.getByText("Backpropagation")).toBeInTheDocument();
    expect(screen.getByText("Computing gradients.")).toBeInTheDocument();
  });

  it("renders one list item per topic", () => {
    render(<TopicsSection topics={topics} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
