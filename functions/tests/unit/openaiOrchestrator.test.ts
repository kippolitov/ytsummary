import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import type { AnalyzeRequest } from "../../src/models/index";

vi.mock("openai", () => ({
  AzureOpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

const baseRequest: AnalyzeRequest = {
  videoId: "abc12345678",
  title: "Intro to Dependency Injection",
  channelName: "DotNet",
  transcript: "In this video we cover dependency injection in .NET",
  durationSeconds: 600,
};

describe("openaiOrchestrator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AZURE_OPENAI_ENDPOINT = "https://fake.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "fake-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
  });

  it("prompt construction contains the transcript text", async () => {
    const { AzureOpenAI } = await import("openai");
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              tldr: [],
              topics: [],
              steps: [],
              references: [],
            }),
          },
        },
      ],
    });
    (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }));

    await orchestrateAnalysis(baseRequest);

    const callArgs = mockCreate.mock.calls[0] as [{ messages: { content: string }[] }];
    const messages = callArgs[0].messages;
    const combinedText = messages.map((m) => m.content).join(" ");
    expect(combinedText).toContain(baseRequest.transcript);
  });

  it("parses valid JSON response into AnalyzeResponse", async () => {
    const { AzureOpenAI } = await import("openai");
    const responsePayload = {
      tldr: ["Bullet one.", "Bullet two."],
      topics: [{ name: "DI", description: "Dependency Injection", timestampSeconds: 30 }],
      steps: [{ order: 1, text: "Step one", timestampSeconds: null }],
      references: [],
    };
    (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(responsePayload) } }],
          }),
        },
      },
    }));

    const result = await orchestrateAnalysis(baseRequest);
    expect(result.tldr).toEqual(["Bullet one.", "Bullet two."]);
    expect(result.topics).toHaveLength(1);
    expect(result.steps).toHaveLength(1);
    expect(result.videoId).toBe(baseRequest.videoId);
  });

  it("throws a structured error on malformed JSON response", async () => {
    const { AzureOpenAI } = await import("openai");
    (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "this is not json {{{" } }],
          }),
        },
      },
    }));

    await expect(orchestrateAnalysis(baseRequest)).rejects.toThrow();
  });
});
