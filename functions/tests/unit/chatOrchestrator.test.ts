import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRequest } from "../../src/models/index";
import { buildChatSystemPrompt } from "../../src/services/chatOrchestrator";

vi.mock("openai", () => {
  const mockStream = {
    [Symbol.asyncIterator]: vi.fn(),
  };
  const mockCreate = vi.fn().mockResolvedValue(mockStream);
  return {
    AzureOpenAI: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
    __mockStream: mockStream,
  };
});

import { streamChatResponse } from "../../src/services/chatOrchestrator";
import { AzureOpenAI } from "openai";

function makeChunk(content: string) {
  return { choices: [{ delta: { content } }] };
}

const BASE_REQUEST: ChatRequest = {
  videoId: "abc12345678",
  videoTitle: "Test Video",
  transcript: "This is a test transcript.",
  messages: [{ role: "user", content: "What is this about?" }],
  mode: "chat",
};

describe("chatOrchestrator — streamChatResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields content deltas from the model stream", async () => {
    const chunks = [makeChunk("Hello"), makeChunk(" world"), { choices: [{ delta: {} }] }];
    const mockStream = {
      [Symbol.asyncIterator]: () => {
        let i = 0;
        return {
          next: () =>
            Promise.resolve(
              i < chunks.length
                ? { value: chunks[i++], done: false }
                : { value: undefined, done: true }
            ),
        };
      },
    };

    const client = new AzureOpenAI({ endpoint: "", apiKey: "", deployment: "gpt-4o-mini", apiVersion: "2024-02-01" });
    (client.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const gen = streamChatResponse(BASE_REQUEST);
    const results: string[] = [];
    for await (const delta of gen) {
      results.push(delta);
    }
    expect(results).toEqual(["Hello", " world"]);
  });

  it("uses conversation history messages for chat mode", async () => {
    const mockStream = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: undefined, done: true }) }) };
    const client = new AzureOpenAI({ endpoint: "", apiKey: "", deployment: "gpt-4o-mini", apiVersion: "2024-02-01" });
    (client.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const requestWithHistory: ChatRequest = {
      ...BASE_REQUEST,
      messages: [
        { role: "user", content: "First question?" },
        { role: "assistant", content: "First answer." },
        { role: "user", content: "Follow-up?" },
      ],
    };

    const gen = streamChatResponse(requestWithHistory);
    for await (const _ of gen) { /* drain */ }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessages = call.messages.filter((m) => m.role === "user" || m.role === "assistant");
    expect(userMessages.length).toBeGreaterThanOrEqual(3);
  });

  it("uses blog-post system prompt and excludes conversation history for blog-post mode", async () => {
    const mockStream = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: undefined, done: true }) }) };
    const client = new AzureOpenAI({ endpoint: "", apiKey: "", deployment: "gpt-4o-mini", apiVersion: "2024-02-01" });
    (client.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const blogRequest: ChatRequest = {
      ...BASE_REQUEST,
      mode: "blog-post",
      messages: [
        { role: "user", content: "Some prior message" },
        { role: "assistant", content: "Some prior answer" },
        { role: "user", content: "Generate Blog Post" },
      ],
    };

    const gen = streamChatResponse(blogRequest);
    for await (const _ of gen) { /* drain */ }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = call.messages.find((m) => m.role === "system");
    expect(systemMsg?.content).toContain("blog post");

    const conversationMessages = call.messages.filter(
      (m) => m.role !== "system" && m.content === "Some prior message"
    );
    expect(conversationMessages).toHaveLength(0);
  });

  it("skips empty delta strings", async () => {
    const chunks = [makeChunk(""), makeChunk("Real content"), makeChunk("")];
    const mockStream = {
      [Symbol.asyncIterator]: () => {
        let i = 0;
        return {
          next: () =>
            Promise.resolve(
              i < chunks.length
                ? { value: chunks[i++], done: false }
                : { value: undefined, done: true }
            ),
        };
      },
    };
    const client = new AzureOpenAI({ endpoint: "", apiKey: "", deployment: "gpt-4o-mini", apiVersion: "2024-02-01" });
    (client.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);

    const gen = streamChatResponse(BASE_REQUEST);
    const results: string[] = [];
    for await (const delta of gen) {
      results.push(delta);
    }
    expect(results).toEqual(["Real content"]);
  });
});

describe("chatOrchestrator — buildChatSystemPrompt formatting guidance", () => {
  it("contains structural formatting instructions: headings, callout, table", () => {
    const prompt = buildChatSystemPrompt("Test Video", "test transcript");
    expect(prompt).toContain("heading");
    expect(prompt).toContain("callout");
    expect(prompt).toContain("table");
  });

  it("instructs use of code blocks with language identifier", () => {
    const prompt = buildChatSystemPrompt("Test Video", "test transcript");
    expect(prompt).toContain("code");
  });

  it("includes the video title and transcript", () => {
    const prompt = buildChatSystemPrompt("My Video", "Some transcript text.");
    expect(prompt).toContain("My Video");
    expect(prompt).toContain("Some transcript text.");
  });
});
