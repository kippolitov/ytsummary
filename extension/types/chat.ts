export type ChatRole = "user" | "assistant";

export type ChatMessageType = "chat" | "blog-post";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  type: ChatMessageType;
  timestamp: number;
}

export interface ChatSession {
  videoId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  videoId: string;
  videoTitle: string;
  transcript: string;
  messages: ChatHistoryItem[];
  mode?: ChatMessageType;
}

export interface ChatStreamChunk {
  delta: string;
}

export interface FollowUpPromptsRequest {
  videoId: string;
  videoTitle: string;
  transcript: string;
  messages: ChatHistoryItem[];
  mode: "follow-up-prompts";
}

export interface FollowUpPromptsResponse {
  prompts: string[];
}
