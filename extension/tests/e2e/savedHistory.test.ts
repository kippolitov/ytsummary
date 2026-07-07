import { test, expect, e2eEnabled, skipReason, VIDEO_A, watchUrl } from "./fixtures";

// This flow exercises the real backend (save/list/get/delete all require a
// genuine, JWKS-verifiable Google ID token — research.md §1 notes the
// interactive OAuth popup itself can't be driven headlessly). Rather than
// automating the OAuth dance, a valid token for an AllowedUsers-authorized
// test account is obtained once (manually, via the real sign-in flow) and
// passed in via E2E_ID_TOKEN, then seeded directly into chrome.storage.local
// the same way a completed sign-in would leave it.
const testIdToken = process.env.E2E_ID_TOKEN;

function decodeIdTokenPayload(idToken: string): { sub: string; email: string; exp: number } {
  const base64 = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

test.describe("US2/US3 — Save, browse, restore, unsave", () => {
  test.skip(
    !e2eEnabled || !testIdToken,
    `${skipReason} Also set E2E_ID_TOKEN to a valid Google ID token for an ` +
      "AllowedUsers-authorized test account (obtained once via the real sign-in " +
      "flow), since this flow exercises the real backend end-to-end."
  );

  test("save a video, browse the Saved view, restore it, then unsave it", async ({
    context,
    sidePanel,
  }) => {
    const payload = decodeIdTokenPayload(testIdToken!);
    await sidePanel.evaluate(
      async ({ idToken, sub, email, expiresAt }) => {
        await chrome.storage.local.set({
          ytsummary_auth: {
            idToken,
            expiresAt,
            user: { sub, email },
            authorizationStatus: "authorized",
          },
        });
      },
      { idToken: testIdToken!, sub: payload.sub, email: payload.email, expiresAt: payload.exp * 1000 }
    );
    await sidePanel.reload();

    const video = await context.newPage();
    await video.goto(watchUrl(VIDEO_A));

    const summary = sidePanel.getByLabel("Key takeaways");
    await expect(summary).toBeVisible({ timeout: 90_000 });

    await sidePanel.getByRole("button", { name: "Save video" }).click();
    await expect(sidePanel.getByRole("button", { name: "Video saved" })).toBeVisible({
      timeout: 15_000,
    });

    await sidePanel.getByRole("tab", { name: "Saved" }).click();
    const savedEntry = sidePanel.getByRole("button", { name: /^Open saved video:/ }).first();
    await expect(savedEntry).toBeVisible({ timeout: 15_000 });
    await savedEntry.click();

    await expect(sidePanel.getByLabel("Key takeaways")).toBeVisible({ timeout: 15_000 });

    await sidePanel.getByRole("button", { name: "Remove from saved videos" }).click();
    await expect(sidePanel.getByText("No saved videos yet")).toBeVisible({ timeout: 15_000 });
  });
});
