export type { ChatMessage, ChatSession, ChatHistoryItem, ChatRequest, ChatStreamChunk, ChatRole, ChatMessageType } from "./chat";

export interface Video {
  videoId: string;
  title: string;
  channelName: string;
  url: string;
  durationSeconds: number;
  transcript: string;
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

export interface AnalysisResult {
  videoId: string;
  tldr: string[];
  topics: Topic[];
  steps: ImplementationStep[];
  references: Reference[];
  analyzedAt: string;
}

export type ErrorCode =
  | "network-error"
  | "service-error"
  | "rate-limited"
  | "transcript-too-long"
  | "unknown";

export interface PanelError {
  code: ErrorCode;
  message: string;
  action: string;
  retryable: boolean;
}

export type PanelStatus = "idle" | "loading" | "ready" | "error" | "no-transcript";

export interface KnowledgePanelState {
  videoId: string;
  status: PanelStatus;
  result: AnalysisResult | null;
  error: PanelError | null;
  analyzedAt: string | null;
}
