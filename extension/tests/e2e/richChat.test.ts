import { test, expect, chromium } from "@playwright/test";

test.describe("Feature 007 — Rich Chat Experience", () => {
  test.skip(
    true,
    "E2E test requires Chrome with extension loaded and a valid Azure Function URL. Run manually per quickstart.md scenarios 1–7."
  );

  test("renders formatted response with headings and follow-up chips", async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    // Allow time for transcript extraction and panel to become interactive
    await page.waitForTimeout(10_000);

    const panel = page.frameLocator("pierce/#video-knowledge-panel-root");

    // Switch to Chat tab
    await panel.locator("button", { hasText: "Chat" }).click();

    // Submit a question that should produce a structured response with headings
    const input = panel.locator("textarea, input[type=text]").last();
    await input.fill("Give me a detailed breakdown with headings and a comparison table");
    await input.press("Enter");

    // Wait for the response to complete (up to 60 s)
    await page.waitForTimeout(60_000);

    // (1) Response should contain at least one heading element
    const heading = panel.locator("h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });

    // (2) Follow-up chips should appear within 2 s of the response
    const chips = panel.locator("button").filter({ hasText: /\?$/ });
    await expect(chips.first()).toBeVisible({ timeout: 5_000 });
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(3);

    // (3) Click the first chip and confirm it appears as a user message
    const firstChipText = await chips.first().textContent();
    await chips.first().click();

    const userBubble = panel.locator("[aria-label='Your message']").last();
    await expect(userBubble).toContainText(firstChipText ?? "", { timeout: 5_000 });

    await browser.close();
  });
});
