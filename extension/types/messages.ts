import type { Video, AnalysisResult, PanelError } from "./index";

export const MessageType = {
  TRANSCRIPT_READY: "TRANSCRIPT_READY",
  NO_TRANSCRIPT: "NO_TRANSCRIPT",
  VIDEO_CHANGED: "VIDEO_CHANGED",
  ANALYSIS_RESULT: "ANALYSIS_RESULT",
  ANALYSIS_ERROR: "ANALYSIS_ERROR",
  RETRY_ANALYSIS: "RETRY_ANALYSIS",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface TranscriptReadyMessage {
  type: typeof MessageType.TRANSCRIPT_READY;
  video: Video;
}

export interface NoTranscriptMessage {
  type: typeof MessageType.NO_TRANSCRIPT;
  videoId: string;
}

export interface VideoChangedMessage {
  type: typeof MessageType.VIDEO_CHANGED;
  videoId: string;
}

export interface AnalysisResultMessage {
  type: typeof MessageType.ANALYSIS_RESULT;
  result: AnalysisResult;
}

export interface AnalysisErrorMessage {
  type: typeof MessageType.ANALYSIS_ERROR;
  error: PanelError;
}

export interface RetryAnalysisMessage {
  type: typeof MessageType.RETRY_ANALYSIS;
  videoId: string;
}

export type ExtensionMessage =
  | TranscriptReadyMessage
  | NoTranscriptMessage
  | VideoChangedMessage
  | AnalysisResultMessage
  | AnalysisErrorMessage
  | RetryAnalysisMessage;
