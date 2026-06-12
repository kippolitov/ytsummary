import {
  test,
  expect,
  e2eEnabled,
  skipReason,
  VIDEO_A,
  VIDEO_B,
  watchUrl,
} from "./fixtures";

test.describe("US2 — Video navigation refresh", () => {
  test.skip(!e2eEnabled, skipReason);

  test("navigating to Video B resets panel and shows new content", async ({
    context,
    sidePanel,
  }) => {
    const video = await context.newPage();
    await video.goto(watchUrl(VIDEO_A));

    const summary = sidePanel.getByLabel("Key takeaways");
    await expect(summary).toBeVisible({ timeout: 90_000 });
    const summaryA = await summary.textContent();
    expect(summaryA).toBeTruthy();

    await video.goto(watchUrl(VIDEO_B));

    await expect(sidePanel.getByRole("status")).toBeVisible({
      timeout: 15_000,
    });

    await expect(summary).toBeVisible({ timeout: 90_000 });
    const summaryB = await summary.textContent();
    expect(summaryB).toBeTruthy();
    expect(summaryB).not.toBe(summaryA);
  });
});
