import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import type { AnalyzeRequest } from "../../src/models/index";

vi.mock("openai", () => ({
  AzureOpenAI: vi.fn(),
}));

import { AzureOpenAI } from "openai";

const baseRequest: AnalyzeRequest = {
  videoId: "abc12345678",
  title: "Edge Cases",
  channelName: "Channel",
  transcript: "transcript",
  durationSeconds: 60,
};

function mockCompletion(content: string | null | undefined): void {
  (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: content === undefined ? [] : [{ message: { content } }],
        }),
      },
    },
  }));
}

describe("openaiOrchestrator — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_OPENAI_ENDPOINT = "https://fake.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "fake-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
  });

  it("throws when the model returns empty content", async () => {
    mockCompletion(null);
    await expect(orchestrateAnalysis(baseRequest)).rejects.toThrow("empty response");
  });

  it("throws when the model returns no choices", async () => {
    mockCompletion(undefined);
    await expect(orchestrateAnalysis(baseRequest)).rejects.toThrow("empty response");
  });

  it("defaults missing or non-array fields to empty arrays", async () => {
    mockCompletion(JSON.stringify({ tldr: "not an array", topics: {}, steps: null }));
    const result = await orchestrateAnalysis(baseRequest);
    expect(result.tldr).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.references).toEqual([]);
  });

  it("filters non-string tldr entries and caps at 7 bullets", async () => {
    const tldr = ["1", 2, "3", null, "4", "5", "6", "7", "8", "9"];
    mockCompletion(JSON.stringify({ tldr, topics: [], steps: [], references: [] }));
    const result = await orchestrateAnalysis(baseRequest);
    expect(result.tldr).toEqual(["1", "3", "4", "5", "6", "7", "8"]);
  });

  it("stamps the videoId and an ISO analyzedAt timestamp", async () => {
    mockCompletion(JSON.stringify({ tldr: [], topics: [], steps: [], references: [] }));
    const result = await orchestrateAnalysis(baseRequest);
    expect(result.videoId).toBe(baseRequest.videoId);
    expect(new Date(result.analyzedAt).toString()).not.toBe("Invalid Date");
  });

  it("uses default deployment when the env var is unset", async () => {
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ tldr: [] }) } }],
    });
    (AzureOpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: { completions: { create } },
    }));

    await orchestrateAnalysis(baseRequest);
    const callArgs = create.mock.calls[0] as [{ model: string }];
    expect(callArgs[0].model).toBe("gpt-4o-mini");
  });
});
