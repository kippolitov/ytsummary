import { test, expect, e2eEnabled, skipReason, watchUrl } from "./fixtures";

const noCaptionsVideoId = process.env.E2E_NO_CAPTIONS_VIDEO;

test.describe("US2/US4 — No-transcript state", () => {
  test.skip(
    !e2eEnabled || !noCaptionsVideoId,
    `${skipReason} Also set E2E_NO_CAPTIONS_VIDEO to the id of a video without captions.`
  );

  test("no-transcript message appears and retry button is absent", async ({
    context,
    sidePanel,
  }) => {
    const video = await context.newPage();
    await video.goto(watchUrl(noCaptionsVideoId!));

    await expect(sidePanel.getByText("No captions available")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      sidePanel.getByRole("button", { name: "Retry analysis" })
    ).not.toBeVisible();
  });
});
