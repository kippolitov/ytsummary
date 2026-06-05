import { test, expect, chromium } from "@playwright/test";

test.describe("US2 — Video navigation refresh", () => {
  test.skip(
    true,
    "E2e test requires Chrome with extension loaded and valid Azure Function URL. Run manually per quickstart.md Scenario 2."
  );

  test("navigating to Video B resets panel and shows new content", async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.waitForTimeout(35_000);

    const summaryA = await page
      .frameLocator("pierce/#video-knowledge-panel-root")
      .locator("[data-testid=summary]")
      .textContent();
    expect(summaryA).toBeTruthy();

    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw");

    const loading = page
      .frameLocator("pierce/#video-knowledge-panel-root")
      .locator("[role=status]");
    await expect(loading).toBeVisible({ timeout: 5_000 });

    await page.waitForTimeout(35_000);

    const summaryB = await page
      .frameLocator("pierce/#video-knowledge-panel-root")
      .locator("[data-testid=summary]")
      .textContent();
    expect(summaryB).toBeTruthy();
    expect(summaryB).not.toBe(summaryA);

    await browser.close();
  });
});
