import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFollowUpPrompts } from "../../services/followUpClient";
import type { FollowUpPromptsRequest } from "../../types/chat";

const BASE_REQUEST: FollowUpPromptsRequest = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is a test transcript.",
  messages: [
    { role: "user", content: "What is this about?" },
    { role: "assistant", content: "It is about testing." },
  ],
  mode: "follow-up-prompts",
};

describe("fetchFollowUpPrompts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("WXT_AZURE_FUNCTION_URL", "http://localhost:7071/api");
    vi.stubGlobal("WXT_AZURE_FUNCTION_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns string array on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ prompts: ["Q1?", "Q2?", "Q3?"] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual(["Q1?", "Q2?", "Q3?"]);
  });

  it("returns [] on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual([]);
  });

  it("returns [] on non-200 HTTP status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "rate-limited" }), { status: 429 })
    );

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual([]);
  });

  it("returns [] on malformed JSON response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("not json at all", { status: 200 })
    );

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual([]);
  });

  it("returns [] when prompts is not an array in the response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ prompts: "not an array" }), { status: 200 })
    );

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual([]);
  });

  it("returns [] without making a request when messages has fewer than 2 items", async () => {
    const shortRequest: FollowUpPromptsRequest = {
      ...BASE_REQUEST,
      messages: [{ role: "user", content: "Only one message." }],
    };

    const result = await fetchFollowUpPrompts(shortRequest);
    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("returns [] when the response has an empty prompts array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ prompts: [] }), { status: 200 })
    );

    const result = await fetchFollowUpPrompts(BASE_REQUEST);
    expect(result).toEqual([]);
  });
});
