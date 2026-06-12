import {
  test,
  expect,
  e2eEnabled,
  skipReason,
  VIDEO_A,
  watchUrl,
} from "./fixtures";

test.describe("Error + retry scenario", () => {
  // The analysis request is made from the background service worker, so it
  // cannot be intercepted with page routing. Point the build at a mock
  // backend whose first /api/analyze call returns 500 and second succeeds,
  // then opt in with E2E_ERROR_RETRY=1.
  test.skip(
    !e2eEnabled || process.env.E2E_ERROR_RETRY !== "1",
    `${skipReason} Also requires E2E_ERROR_RETRY=1 and a mock backend that fails the first /api/analyze call.`
  );

  test("error message and retry button appear; retry succeeds", async ({
    context,
    sidePanel,
  }) => {
    const video = await context.newPage();
    await video.goto(watchUrl(VIDEO_A));

    const retryButton = sidePanel.getByRole("button", {
      name: "Retry analysis",
    });
    await expect(retryButton).toBeVisible({ timeout: 90_000 });

    await retryButton.click();

    await expect(sidePanel.getByLabel("Key takeaways")).toBeVisible({
      timeout: 90_000,
    });
  });
});
