import { test, expect } from "@playwright/test";

test.describe("Error + retry scenario", () => {
  test.skip(
    true,
    "E2e test requires Chrome with extension loaded and a mock Azure Function returning 500. Run manually per quickstart.md Scenario 5."
  );

  test("error message and retry button appear; retry succeeds", async ({
    page,
  }) => {
    await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.waitForTimeout(50_000);

    const panel = page.frameLocator("pierce/#video-knowledge-panel-root");
    const retryButton = panel.locator("button[aria-label='Retry analysis']");
    await expect(retryButton).toBeVisible({ timeout: 5_000 });

    await retryButton.click();
    await page.waitForTimeout(35_000);

    await expect(panel.locator("[data-testid=summary]")).toBeVisible({ timeout: 5_000 });
  });
});
