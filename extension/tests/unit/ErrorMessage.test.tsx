import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorMessage } from "../../components/shared/ErrorMessage";
import type { PanelError } from "../../types/index";

const retryableError: PanelError = {
  code: "network-error",
  message: "Could not reach the analysis service.",
  action: "Check your internet connection and try again.",
  retryable: true,
};

const nonRetryableError: PanelError = {
  code: "transcript-too-long",
  message: "The video could not be analyzed.",
  action: "Try a shorter video.",
  retryable: false,
};

describe("ErrorMessage", () => {
  it("renders the error message and action as an alert", () => {
    render(<ErrorMessage error={retryableError} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(retryableError.message)).toBeInTheDocument();
    expect(screen.getByText(retryableError.action)).toBeInTheDocument();
  });

  it("shows a retry button for retryable errors when onRetry is provided", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorMessage error={retryableError} onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "Retry analysis" });
    await user.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the retry button for non-retryable errors", () => {
    render(<ErrorMessage error={nonRetryableError} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the retry button when onRetry is not provided", () => {
    render(<ErrorMessage error={retryableError} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
