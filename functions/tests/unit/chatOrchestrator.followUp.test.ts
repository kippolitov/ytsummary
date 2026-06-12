import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRequest } from "../../src/models/index";

vi.mock("openai", () => ({
  AzureOpenAI: vi.fn(),
}));

import { generateFollowUpPrompts } from "../../src/services/chatOrchestrator";
import { AzureOpenAI } from "openai";

const BASE_REQUEST: ChatRequest = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is a test transcript.",
  messages: [
    { role: "user", content: "What is this about?" },
    { role: "assistant", content: "It is about testing." },
  ],
  mode: "follow-up-prompts",
};

function mockCompletion(content: string | null): ReturnType<typeof vi.fn> {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    chat: { completions: { create } },
  }));
  return create;
}

describe("chatOrchestrator — generateFollowUpPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_OPENAI_ENDPOINT = "https://fake.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "fake-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
  });

  it("returns the parsed array of follow-up prompts", async () => {
    mockCompletion(JSON.stringify(["Q1?", "Q2?", "Q3?"]));
    await expect(generateFollowUpPrompts(BASE_REQUEST)).resolves.toEqual(["Q1?", "Q2?", "Q3?"]);
  });

  it("sends the last assistant response as context", async () => {
    const create = mockCompletion(JSON.stringify(["Q?"]));
    const request: ChatRequest = {
      ...BASE_REQUEST,
      messages: [
        { role: "user", content: "First?" },
        { role: "assistant", content: "First answer." },
        { role: "user", content: "Second?" },
        { role: "assistant", content: "Latest answer." },
      ],
    };

    await generateFollowUpPrompts(request);

    const call = create.mock.calls[0]![0] as { messages: Array<{ role: string; content: string }> };
    const userMsg = call.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Latest answer.");
    expect(userMsg?.content).toContain("Test Video");
    expect(userMsg?.content).not.toContain("First answer.");
  });

  it("falls back to title-only context when no assistant message exists", async () => {
    const create = mockCompletion(JSON.stringify(["Q?"]));
    const request: ChatRequest = {
      ...BASE_REQUEST,
      messages: [{ role: "user", content: "Only a question?" }],
    };

    await generateFollowUpPrompts(request);

    const call = create.mock.calls[0]![0] as { messages: Array<{ role: string; content: string }> };
    const userMsg = call.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toBe("Video: Test Video");
  });

  it("requests a non-streaming completion", async () => {
    const create = mockCompletion(JSON.stringify(["Q?"]));
    await generateFollowUpPrompts(BASE_REQUEST);
    expect(create.mock.calls[0]![0]).toMatchObject({ stream: false });
  });

  it("throws when the model returns a JSON object instead of an array", async () => {
    mockCompletion(JSON.stringify({ prompts: ["Q?"] }));
    await expect(generateFollowUpPrompts(BASE_REQUEST)).rejects.toThrow("Expected JSON array");
  });

  it("throws when the model returns invalid JSON", async () => {
    mockCompletion("not json at all");
    await expect(generateFollowUpPrompts(BASE_REQUEST)).rejects.toThrow();
  });

  it("returns an empty array when the model returns no content", async () => {
    mockCompletion(null);
    await expect(generateFollowUpPrompts(BASE_REQUEST)).resolves.toEqual([]);
  });
});
