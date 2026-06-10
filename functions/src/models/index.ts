export interface AnalyzeRequest {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  durationSeconds: number;
}

export interface Topic {
  name: string;
  description: string;
  timestampSeconds: number | null;
}

export interface ImplementationStep {
  order: number;
  text: string;
  timestampSeconds: number | null;
}

export interface Reference {
  name: string;
  description: string;
  url: string | null;
  context: string;
}

export interface AnalyzeResponse {
  videoId: string;
  tldr: string[];
  topics: Topic[];
  steps: ImplementationStep[];
  references: Reference[];
  analyzedAt: string;
}

export interface FunctionError {
  error: {
    code: string;
    message: string;
  };
}

export type ChatMode = "chat" | "blog-post" | "follow-up-prompts";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  videoId: string;
  videoTitle: string;
  transcript: string;
  messages: ChatHistoryItem[];
  mode?: ChatMode;
}

export function isChatRequest(body: unknown): body is ChatRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.videoId === "string" &&
    /^[a-zA-Z0-9_-]{11}$/.test(b.videoId) &&
    typeof b.videoTitle === "string" &&
    b.videoTitle.length <= 500 &&
    typeof b.transcript === "string" &&
    Array.isArray(b.messages) &&
    b.messages.length >= 1
  );
}

export function isFollowUpPromptsRequest(body: ChatRequest): boolean {
  return body.mode === "follow-up-prompts" && body.messages.length >= 2;
}

export function isAnalyzeRequest(body: unknown): body is AnalyzeRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.videoId === "string" &&
    /^[a-zA-Z0-9_-]{11}$/.test(b.videoId) &&
    typeof b.title === "string" &&
    b.title.length <= 500 &&
    typeof b.channelName === "string" &&
    b.channelName.length <= 200 &&
    typeof b.transcript === "string" &&
    typeof b.durationSeconds === "number" &&
    b.durationSeconds >= 0
  );
}
