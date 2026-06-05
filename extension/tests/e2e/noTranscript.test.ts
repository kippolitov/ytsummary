import { test, expect } from "@playwright/test";

test.describe("US2/US4 — No-transcript state", () => {
  test.skip(
    true,
    "E2e test requires Chrome with extension loaded. Run manually per quickstart.md Scenario 4."
  );

  test("no-transcript message appears and retry button is absent", async ({
    page,
  }) => {
    await page.goto("https://www.youtube.com/watch?v=PLACEHOLDER_NO_CAPTIONS");
    await page.waitForTimeout(10_000);

    const panel = page.frameLocator("pierce/#video-knowledge-panel-root");
    await expect(panel.locator("text=No captions available")).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.locator("button[aria-label='Retry analysis']")).not.toBeVisible();
  });
});
