export type { ChatMessage, ChatSession, ChatHistoryItem, ChatRequest, ChatStreamChunk, ChatRole, ChatMessageType } from "./chat";
import type { ChatMessage } from "./chat";

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
  | "unauthenticated"
  | "not-authorized"
  | "unknown";

export interface PanelError {
  code: ErrorCode;
  message: string;
  action: string;
  retryable: boolean;
}

export type PanelStatus = "idle" | "loading" | "ready" | "error" | "no-transcript";

/** One entry of the GET /api/saved-videos list response body (contracts/saved-videos-api.md). */
export interface SavedVideoSummary {
  videoId: string;
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  savedAt: string;
  updatedAt: string;
}

/** GET /api/saved-videos/{videoId} and PUT response body (contracts/saved-videos-api.md). */
export interface SavedVideoDetail {
  videoId: string;
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  summary: AnalysisResult;
  messages: ChatMessage[];
  savedAt: string;
  updatedAt: string;
}

export interface KnowledgePanelState {
  videoId: string;
  status: PanelStatus;
  result: AnalysisResult | null;
  error: PanelError | null;
  analyzedAt: string | null;
}
