import type { Video, AnalysisResult, PanelError } from "./index";

export const MessageType = {
  TRANSCRIPT_READY: "TRANSCRIPT_READY",
  NO_TRANSCRIPT: "NO_TRANSCRIPT",
  VIDEO_CHANGED: "VIDEO_CHANGED",
  ANALYSIS_RESULT: "ANALYSIS_RESULT",
  ANALYSIS_ERROR: "ANALYSIS_ERROR",
  RETRY_ANALYSIS: "RETRY_ANALYSIS",
  REQUEST_TRANSCRIPT: "REQUEST_TRANSCRIPT",
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

/** Sent from background to a specific tab's content script — asks it to
 * (re)extract the transcript for whatever video is currently loaded there.
 * Only dispatched when the side panel is open, so a tab is never read
 * unless the user has actually invoked the extension. */
export interface RequestTranscriptMessage {
  type: typeof MessageType.REQUEST_TRANSCRIPT;
}

export type ExtensionMessage =
  | TranscriptReadyMessage
  | NoTranscriptMessage
  | VideoChangedMessage
  | AnalysisResultMessage
  | AnalysisErrorMessage
  | RetryAnalysisMessage
  | RequestTranscriptMessage;
