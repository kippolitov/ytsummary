import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepsSection } from "../../components/sections/StepsSection";
import type { ImplementationStep } from "../../types/index";

const steps: ImplementationStep[] = [
  { order: 1, text: "Install the package", timestampSeconds: null },
  { order: 2, text: "Configure the settings", timestampSeconds: 45 },
];

describe("StepsSection", () => {
  it("renders an ordered list when steps is non-empty", () => {
    render(<StepsSection steps={steps} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Install the package")).toBeInTheDocument();
    expect(screen.getByText("Configure the settings")).toBeInTheDocument();
  });

  it("displays step order numbers", () => {
    render(<StepsSection steps={steps} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders nothing when steps is an empty array", () => {
    const { container } = render(<StepsSection steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a section heading", () => {
    render(<StepsSection steps={steps} />);
    expect(screen.getByRole("region", { name: /steps/i })).not.toBeNull();
  });
});
