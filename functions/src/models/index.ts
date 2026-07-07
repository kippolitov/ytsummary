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

/**
 * New FunctionError codes introduced by auth/saved-history (contracts/auth.md,
 * contracts/saved-videos-api.md): "unauthenticated" (401 — missing/invalid/expired
 * bearer token), "not-authorized" (403 — valid Google identity, not on AllowedUsers),
 * "not-found" (404 — no saved video for this videoId/account), and
 * "saved-video-limit-reached" (409 — 200-saved-video-per-account cap, FR-019).
 */

/** The verified caller identity attached to the request by withAuth (services/auth.ts). Never persisted. */
export interface AuthenticatedUser {
  sub: string;
  email: string;
}

/** Mirrors extension/types/chat.ts's ChatMessage shape (contracts/saved-videos-api.md). */
export interface SavedChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "chat" | "blog-post";
  timestamp: number;
}

/** PUT /api/saved-videos/{videoId} request body (contracts/saved-videos-api.md). */
export interface SavedVideoRequest {
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  summary: AnalyzeResponse;
  messages: SavedChatMessage[];
}

/** GET /api/saved-videos/{videoId} and PUT response body. */
export interface SavedVideoDetailResponse {
  videoId: string;
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  summary: AnalyzeResponse;
  messages: SavedChatMessage[];
  savedAt: string;
  updatedAt: string;
}

/** One entry of the GET /api/saved-videos list response body. */
export interface SavedVideoSummaryResponse {
  videoId: string;
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  savedAt: string;
  updatedAt: string;
}

function isAnalyzeResponseShape(value: unknown): value is AnalyzeResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.tldr) &&
    Array.isArray(v.topics) &&
    Array.isArray(v.steps) &&
    Array.isArray(v.references) &&
    typeof v.analyzedAt === "string"
  );
}

function isSavedChatMessageArray(value: unknown): value is SavedChatMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every((m) => {
    if (typeof m !== "object" || m === null) return false;
    const item = m as Record<string, unknown>;
    return (
      typeof item.id === "string" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      (item.type === "chat" || item.type === "blog-post") &&
      typeof item.timestamp === "number"
    );
  });
}

export function isSavedVideoRequest(body: unknown): body is SavedVideoRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.videoTitle === "string" &&
    b.videoTitle.length <= 500 &&
    typeof b.channelName === "string" &&
    b.channelName.length <= 200 &&
    typeof b.videoUrl === "string" &&
    typeof b.durationSeconds === "number" &&
    b.durationSeconds >= 0 &&
    isAnalyzeResponseShape(b.summary) &&
    isSavedChatMessageArray(b.messages)
  );
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
