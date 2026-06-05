import { AzureOpenAI } from "@azure/openai";
import type { AnalyzeRequest, AnalyzeResponse } from "../models/index";

function buildPrompt(req: AnalyzeRequest): string {
  return `You are a YouTube video knowledge assistant. Analyze the following video transcript and extract structured knowledge.

Video title: ${req.title}
Channel: ${req.channelName}
Duration: ${req.durationSeconds} seconds

Transcript:
${req.transcript}

Return a JSON object with EXACTLY this structure (no extra fields):
{
  "summary": "3-5 sentence plain-language overview of the video",
  "topics": [
    { "name": "Topic name", "description": "1-2 sentence description", "timestampSeconds": null }
  ],
  "steps": [
    { "order": 1, "text": "Step description", "timestampSeconds": null }
  ],
  "references": [
    { "name": "Resource name", "description": "What it is", "url": null, "context": "How presenter mentioned it" }
  ]
}

Rules:
- topics: extract major concepts covered. Empty array if none identifiable.
- steps: extract ordered procedural instructions only for tutorial/how-to content. Empty array for opinion/news/interview content.
- references: extract named tools, libraries, products, papers, websites. Empty array if none mentioned.
- timestampSeconds: use null unless you can determine it from context.
- Return valid JSON only. No markdown fences.`;
}

export async function orchestrateAnalysis(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";

  const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion: "2024-02-01" });

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: "You are a precise knowledge extractor. Return valid JSON only." },
      { role: "user", content: buildPrompt(req) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  let parsed: {
    summary?: unknown;
    topics?: unknown;
    steps?: unknown;
    references?: unknown;
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    throw new Error(`Failed to parse OpenAI response as JSON: ${content.slice(0, 100)}`);
  }

  return {
    videoId: req.videoId,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    topics: Array.isArray(parsed.topics) ? parsed.topics as AnalyzeResponse["topics"] : [],
    steps: Array.isArray(parsed.steps) ? parsed.steps as AnalyzeResponse["steps"] : [],
    references: Array.isArray(parsed.references) ? parsed.references as AnalyzeResponse["references"] : [],
    analyzedAt: new Date().toISOString(),
  };
}
