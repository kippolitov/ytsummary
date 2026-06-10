import { AzureOpenAI } from "openai";
import type { ChatRequest } from "../models/index";

const FOLLOW_UP_SYSTEM_PROMPT = `You generate follow-up questions for a YouTube video conversation assistant.
Given the conversation history below, produce exactly 3 follow-up questions that would help the user explore deeper insights, challenge assumptions, discover related topics, or take meaningful next steps based on what was discussed.

Rules:
- Return ONLY a valid JSON array of 3 strings: ["Q1", "Q2", "Q3"]
- Each question must end with "?"
- Questions must be specific to this conversation — not generic
- No duplicates`;

export function buildChatSystemPrompt(videoTitle: string, transcript: string): string {
  return `You are an AI assistant helping the user understand a YouTube video.
Video title: ${videoTitle}
Transcript:
---
${transcript}
---
Answer questions based primarily on the transcript. If a question cannot be answered from the transcript, clearly say so, then provide relevant general context. Supplement your answers with deeper explanations when asked to elaborate or dive deeper — distinguishing "In the video, ..." from "More broadly, ..." where helpful. Keep answers accurate and concise.

Formatting guidance for multi-section answers:
- Use ## headings to divide responses into named sections when the answer covers multiple topics
- Use callout blocks (> **Key Insight**: text) for important takeaways or key conclusions
- Use markdown tables for comparisons or structured data
- Use fenced code blocks with a language identifier (e.g. \`\`\`typescript) for any code examples
- Keep answers concise while structured; skip headings for short single-topic answers`;
}

function buildBlogPostSystemPrompt(videoTitle: string, transcript: string): string {
  return `You are a professional content writer. Based on the following YouTube video transcript, write a well-structured blog post suitable for publication.
Video title: ${videoTitle}
Transcript:
---
${transcript}
---
The blog post MUST include:
- A compelling title (use markdown # heading)
- An introduction (2-3 sentences)
- 2-5 content sections, each with a heading (use markdown ## headings) and body paragraphs
- A conclusion (2-3 sentences)
- Use > **Key Insight**: callout blocks for the most important takeaway in each section
Target length: 600-1,200 words. Use markdown formatting for headings and emphasis.`;
}

export async function generateFollowUpPrompts(req: ChatRequest): Promise<string[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";

  const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion: "2024-02-01" });

  const lastAssistantMsg = req.messages.slice().reverse().find((m) => m.role === "assistant");
  const contextSummary = lastAssistantMsg
    ? `Video: ${req.videoTitle}\n\nLast response: ${lastAssistantMsg.content}`
    : `Video: ${req.videoTitle}`;

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: FOLLOW_UP_SYSTEM_PROMPT },
      { role: "user", content: contextSummary },
    ],
    stream: false,
    temperature: 0.8,
    max_tokens: 300,
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
  return parsed as string[];
}

export async function* streamChatResponse(req: ChatRequest): AsyncGenerator<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";

  const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion: "2024-02-01" });

  const mode = req.mode ?? "chat";

  const systemContent =
    mode === "blog-post"
      ? buildBlogPostSystemPrompt(req.videoTitle, req.transcript)
      : buildChatSystemPrompt(req.videoTitle, req.transcript);

  const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> =
    mode === "blog-post"
      ? [{ role: "user", content: "Generate a blog post about this video." }]
      : req.messages.map((m) => ({ role: m.role, content: m.content }));

  const stream = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: systemContent },
      ...conversationMessages,
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      yield delta;
    }
  }
}
