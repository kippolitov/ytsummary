import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInGate } from "../../components/Auth/SignInGate";
import type { AuthState } from "../../types/auth";

describe("SignInGate", () => {
  it("shows a checking indicator while auth status is unknown", () => {
    const auth: AuthState = { status: "checking", user: null };
    render(
      <SignInGate auth={auth} onSignIn={vi.fn()} onSignOut={vi.fn()}>
        <div>secret content</div>
      </SignInGate>
    );
    expect(screen.getByRole("status", { name: "Checking sign-in status" })).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("shows the sign-in prompt when signed out and triggers onSignIn", async () => {
    const onSignIn = vi.fn();
    const auth: AuthState = { status: "signed-out", user: null };
    render(
      <SignInGate auth={auth} onSignIn={onSignIn} onSignOut={vi.fn()}>
        <div>secret content</div>
      </SignInGate>
    );

    expect(screen.getByText("Sign in with Google to use this extension")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows the invitation-only message when signed in but not authorized, and triggers onSignOut", async () => {
    const onSignOut = vi.fn();
    const auth: AuthState = {
      status: "not-authorized",
      user: { sub: "123", email: "stranger@example.com" },
    };
    render(
      <SignInGate auth={auth} onSignIn={vi.fn()} onSignOut={onSignOut}>
        <div>secret content</div>
      </SignInGate>
    );

    expect(screen.getByText("Access to this extension is invitation-only.")).toBeInTheDocument();
    expect(screen.getByText("stranger@example.com hasn't been invited yet.")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders the authorized children when signed in", () => {
    const auth: AuthState = {
      status: "signed-in",
      user: { sub: "123", email: "allowed@example.com" },
    };
    render(
      <SignInGate auth={auth} onSignIn={vi.fn()} onSignOut={vi.fn()}>
        <div>secret content</div>
      </SignInGate>
    );

    expect(screen.getByText("secret content")).toBeInTheDocument();
    expect(screen.queryByText("Sign in with Google to use this extension")).not.toBeInTheDocument();
    expect(screen.queryByText("Access to this extension is invitation-only.")).not.toBeInTheDocument();
  });
});
