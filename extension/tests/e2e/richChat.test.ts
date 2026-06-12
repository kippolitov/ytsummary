import {
  test,
  expect,
  e2eEnabled,
  skipReason,
  VIDEO_A,
  watchUrl,
} from "./fixtures";

test.describe("Feature 007 — Rich Chat Experience", () => {
  test.skip(!e2eEnabled, skipReason);

  test("renders formatted response with headings and follow-up chips", async ({
    context,
    sidePanel,
  }) => {
    const video = await context.newPage();
    await video.goto(watchUrl(VIDEO_A));

    // Wait for analysis to finish so the chat has a video context
    await expect(sidePanel.getByLabel("Key takeaways")).toBeVisible({
      timeout: 90_000,
    });

    await sidePanel.getByRole("tab", { name: "Chat" }).click();

    const input = sidePanel.getByLabel("Chat message input");
    await input.fill(
      "Give me a detailed breakdown with headings and a comparison table"
    );
    await input.press("Enter");

    // (1) Response should contain at least one heading element
    const response = sidePanel.getByLabel("Assistant response").last();
    await expect(response.locator("h2, h3").first()).toBeVisible({
      timeout: 90_000,
    });

    // (2) Follow-up chips should appear after the response completes
    const chips = sidePanel.getByRole("button").filter({ hasText: /\?$/ });
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    expect(await chips.count()).toBeGreaterThanOrEqual(3);

    // (3) Click the first chip and confirm it is sent as a user message
    const firstChipText = await chips.first().textContent();
    await chips.first().click();

    const userBubble = sidePanel.getByLabel("Your message").last();
    await expect(userBubble).toContainText(firstChipText ?? "", {
      timeout: 15_000,
    });
  });
});
