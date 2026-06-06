import { AzureOpenAI } from "openai";
import type { ChatRequest } from "../models/index";

function buildChatSystemPrompt(videoTitle: string, transcript: string): string {
  return `You are an AI assistant helping the user understand a YouTube video.
Video title: ${videoTitle}
Transcript:
---
${transcript}
---
Answer questions based primarily on the transcript. If a question cannot be answered from the transcript, clearly say so, then provide relevant general context. Supplement your answers with deeper explanations when asked to elaborate or dive deeper — distinguishing "In the video, ..." from "More broadly, ..." where helpful. Keep answers accurate and concise.`;
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
Target length: 600-1,200 words. Use markdown formatting for headings and emphasis.`;
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

  const conversationMessages =
    mode === "blog-post"
      ? ([{ role: "user" as const, content: "Generate a blog post about this video." }])
      : req.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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
