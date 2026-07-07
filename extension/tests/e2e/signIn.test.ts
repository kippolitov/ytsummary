import { test, expect, e2eEnabled, skipReason } from "./fixtures";

// The interactive Google OAuth popup itself can't be driven headlessly without
// real credentials (see research.md §1); backend token verification is covered
// by functions/tests/integration/auth.test.ts and client decoding/storage by
// tests/unit/authClient.test.ts. This E2E test drives the real built extension's
// SignInGate rendering for both client-observable states: no session at all
// (signed-out), and a session whose account failed the AllowedUsers check
// (not-authorized) — seeded directly into chrome.storage.local, which is exactly
// what a completed-but-unauthorized sign-in leaves behind.
test.describe("US1 — Sign-in gating", () => {
  test.skip(!e2eEnabled, skipReason);

  test("unauthenticated user sees the sign-in prompt and cannot reach Summary/Chat", async ({
    sidePanel,
  }) => {
    await expect(
      sidePanel.getByText("Sign in with Google to use this extension")
    ).toBeVisible({ timeout: 30_000 });
    await expect(sidePanel.getByRole("tablist")).not.toBeVisible();
    await expect(
      sidePanel.getByRole("button", { name: "Sign in with Google" })
    ).toBeVisible();
  });

  test("an unauthorized account sees the invitation-only message with no feature access", async ({
    sidePanel,
  }) => {
    await sidePanel.evaluate(async () => {
      await chrome.storage.local.set({
        ytsummary_auth: {
          idToken: "fake.token.sig",
          expiresAt: Date.now() + 60 * 60 * 1000,
          user: { sub: "test-sub", email: "stranger@example.com" },
          authorizationStatus: "not-authorized",
        },
      });
    });
    await sidePanel.reload();

    await expect(
      sidePanel.getByText("Access to this extension is invitation-only.")
    ).toBeVisible({ timeout: 30_000 });
    await expect(sidePanel.getByRole("tablist")).not.toBeVisible();
  });
});
