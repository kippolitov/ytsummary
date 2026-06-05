import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateAnalysis } from "../../src/services/openaiOrchestrator";
import type { AnalyzeRequest } from "../../src/models/index";

vi.mock("@azure/openai", () => ({
  AzureOpenAI: vi.fn(),
}));

const tutorialRequest: AnalyzeRequest = {
  videoId: "tutorial1234",
  title: "How to Build a REST API in Node.js",
  channelName: "CodeTuts",
  transcript:
    "Step 1: Initialize your project with npm init. Step 2: Install Express with npm install express. Step 3: Create your server file. Step 4: Define your routes. Step 5: Start the server with node index.js.",
  durationSeconds: 900,
};

const opinionRequest: AnalyzeRequest = {
  videoId: "opinion12345",
  title: "My Thoughts on TypeScript in 2026",
  channelName: "TechOpinions",
  transcript:
    "TypeScript has become the dominant language for frontend development. I think its type system is both its greatest strength and weakness. The community has grown enormously. In my view, it will continue to dominate for the foreseeable future.",
  durationSeconds: 480,
};

describe("openaiOrchestrator — steps extraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AZURE_OPENAI_ENDPOINT = "https://fake.openai.azure.com/";
    process.env.AZURE_OPENAI_API_KEY = "fake-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
  });

  it("tutorial transcript produces non-empty steps array", async () => {
    const { AzureOpenAI } = await import("@azure/openai");
    (AzureOpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "A tutorial on building REST APIs.",
                    topics: [],
                    steps: [
                      { order: 1, text: "npm init", timestampSeconds: null },
                      { order: 2, text: "npm install express", timestampSeconds: null },
                    ],
                    references: [],
                  }),
                },
              },
            ],
          }),
        },
      },
    }));

    const result = await orchestrateAnalysis(tutorialRequest);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("opinion piece transcript produces empty steps array", async () => {
    const { AzureOpenAI } = await import("@azure/openai");
    (AzureOpenAI as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "An opinion on TypeScript.",
                    topics: [{ name: "TypeScript", description: "Dominant frontend language", timestampSeconds: null }],
                    steps: [],
                    references: [],
                  }),
                },
              },
            ],
          }),
        },
      },
    }));

    const result = await orchestrateAnalysis(opinionRequest);
    expect(result.steps).toHaveLength(0);
  });
});
