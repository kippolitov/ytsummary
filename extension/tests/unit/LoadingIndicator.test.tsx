import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingIndicator } from "../../components/shared/LoadingIndicator";

describe("LoadingIndicator", () => {
  it("renders an accessible status region", () => {
    render(<LoadingIndicator />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Analyzing video, please wait");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("shows the analyzing copy", () => {
    render(<LoadingIndicator />);
    expect(screen.getByText("Analyzing video…")).toBeInTheDocument();
    expect(screen.getByText("This may take a few seconds")).toBeInTheDocument();
  });
});
