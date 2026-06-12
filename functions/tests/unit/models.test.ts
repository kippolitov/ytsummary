import { describe, it, expect } from "vitest";
import {
  isChatRequest,
  isFollowUpPromptsRequest,
  isAnalyzeRequest,
} from "../../src/models/index";
import type { ChatRequest } from "../../src/models/index";

const validChat = {
  videoId: "abc12345678",
  videoTitle: "Title",
  transcript: "transcript",
  messages: [{ role: "user", content: "?" }],
};

const validAnalyze = {
  videoId: "abc12345678",
  title: "Title",
  channelName: "Channel",
  transcript: "transcript",
  durationSeconds: 60,
};

describe("isChatRequest", () => {
  it("accepts a valid chat request", () => {
    expect(isChatRequest(validChat)).toBe(true);
  });

  it.each([null, undefined, "string", 42])("rejects non-object body %s", (body) => {
    expect(isChatRequest(body)).toBe(false);
  });

  it("rejects an invalid videoId format", () => {
    expect(isChatRequest({ ...validChat, videoId: "short" })).toBe(false);
    expect(isChatRequest({ ...validChat, videoId: "has spaces!!" })).toBe(false);
  });

  it("rejects a missing or oversized videoTitle", () => {
    expect(isChatRequest({ ...validChat, videoTitle: undefined })).toBe(false);
    expect(isChatRequest({ ...validChat, videoTitle: "x".repeat(501) })).toBe(false);
  });

  it("rejects a non-string transcript", () => {
    expect(isChatRequest({ ...validChat, transcript: 42 })).toBe(false);
  });

  it("rejects empty or non-array messages", () => {
    expect(isChatRequest({ ...validChat, messages: [] })).toBe(false);
    expect(isChatRequest({ ...validChat, messages: "nope" })).toBe(false);
  });
});

describe("isFollowUpPromptsRequest", () => {
  const followUp: ChatRequest = {
    ...validChat,
    mode: "follow-up-prompts",
    messages: [
      { role: "user", content: "?" },
      { role: "assistant", content: "!" },
    ],
  } as ChatRequest;

  it("accepts follow-up-prompts mode with at least 2 messages", () => {
    expect(isFollowUpPromptsRequest(followUp)).toBe(true);
  });

  it("rejects other modes", () => {
    expect(isFollowUpPromptsRequest({ ...followUp, mode: "chat" })).toBe(false);
    expect(isFollowUpPromptsRequest({ ...followUp, mode: undefined })).toBe(false);
  });

  it("rejects fewer than 2 messages", () => {
    expect(
      isFollowUpPromptsRequest({ ...followUp, messages: [{ role: "user", content: "?" }] })
    ).toBe(false);
  });
});

describe("isAnalyzeRequest", () => {
  it("accepts a valid analyze request", () => {
    expect(isAnalyzeRequest(validAnalyze)).toBe(true);
  });

  it.each([null, undefined, "string", 42])("rejects non-object body %s", (body) => {
    expect(isAnalyzeRequest(body)).toBe(false);
  });

  it("rejects an invalid videoId format", () => {
    expect(isAnalyzeRequest({ ...validAnalyze, videoId: "bad id" })).toBe(false);
  });

  it("rejects an oversized title or channelName", () => {
    expect(isAnalyzeRequest({ ...validAnalyze, title: "x".repeat(501) })).toBe(false);
    expect(isAnalyzeRequest({ ...validAnalyze, channelName: "x".repeat(201) })).toBe(false);
  });

  it("rejects a missing transcript", () => {
    expect(isAnalyzeRequest({ ...validAnalyze, transcript: undefined })).toBe(false);
  });

  it("rejects a negative or non-numeric durationSeconds", () => {
    expect(isAnalyzeRequest({ ...validAnalyze, durationSeconds: -1 })).toBe(false);
    expect(isAnalyzeRequest({ ...validAnalyze, durationSeconds: "60" })).toBe(false);
  });
});
