import { describe, it, expect } from "vitest";
import { MessageType } from "../../types/messages";

describe("MessageType", () => {
  it("defines a stable string value for every message type", () => {
    expect(MessageType).toEqual({
      TRANSCRIPT_READY: "TRANSCRIPT_READY",
      NO_TRANSCRIPT: "NO_TRANSCRIPT",
      VIDEO_CHANGED: "VIDEO_CHANGED",
      ANALYSIS_RESULT: "ANALYSIS_RESULT",
      ANALYSIS_ERROR: "ANALYSIS_ERROR",
      RETRY_ANALYSIS: "RETRY_ANALYSIS",
    });
  });
});
