import { postAnalysis } from "../services/analysisClient";
import { getResult, hasResult, setResult, setLastVideo, getLastVideo, storeVideo } from "../services/sessionCache";
import { getStoredAuth, signInSilently, signOut as authSignOut } from "../services/authClient";
import { MessageType } from "../types/messages";
import type {
  ExtensionMessage,
  AnalysisResultMessage,
  AnalysisErrorMessage,
} from "../types/messages";
import type { PanelError, Video } from "../types/index";

declare const WXT_AZURE_FUNCTION_URL: string;

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const SIDE_PANEL_PORT_NAME = "sidepanel";

/**
 * True only while the side panel is connected. Gates every transcript
 * read/analysis: a tab's content script is never asked for its transcript
 * unless the user has actually opened the panel (FR: no background reading).
 */
let panelOpen = false;

export default defineBackground({
  main() {
    console.log("[background] service URL configured:", !!WXT_AZURE_FUNCTION_URL);
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    void ensureFreshAuth();

    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse) => {
        if (message.type === MessageType.TRANSCRIPT_READY) {
          void handleTranscriptReady(message.video);
        } else if (message.type === MessageType.NO_TRANSCRIPT) {
          void handleNoTranscript(message.videoId);
        } else if (message.type === MessageType.RETRY_ANALYSIS) {
          void handleRetryAnalysis(message.videoId);
        }
        sendResponse({ received: true });
        return true;
      }
    );

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== SIDE_PANEL_PORT_NAME) return;
      panelOpen = true;
      void requestTranscriptForActiveTab();
      port.onDisconnect.addListener(() => {
        panelOpen = false;
      });
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (!panelOpen) return;
      void requestTranscriptForTab(activeInfo.tabId);
    });

    // A hard navigation (typed URL, clicked link that isn't a YouTube SPA
    // soft-nav) reloads the page and re-injects the content script from
    // scratch, discarding its "armed" state. onActivated doesn't fire for
    // this — the tab doesn't change, only its document does — so it needs
    // its own trigger, still gated to the active tab of an open panel.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!panelOpen || !tab.active || changeInfo.status !== "complete") return;
      requestTranscriptForTab(tabId);
    });
  },
});

async function requestTranscriptForActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) void requestTranscriptForTab(tab.id);
}

function requestTranscriptForTab(tabId: number): void {
  chrome.tabs.sendMessage(tabId, { type: MessageType.REQUEST_TRANSCRIPT }).catch(() => {
    // Tab isn't a YouTube watch page, or has no content script loaded yet.
  });
}

/**
 * Attempts silent token renewal on every extension/background start (research.md §1) —
 * not a hand-built timer. Only acts on an existing session (a user who never signed in
 * has nothing to refresh); if silent renewal fails, clears the stored session so the
 * side panel falls back to prompting an interactive sign-in (FR-006a).
 */
export async function ensureFreshAuth(): Promise<void> {
  const stored = await getStoredAuth();
  if (!stored) return;
  if (stored.expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS) return;

  const user = await signInSilently();
  if (!user) {
    await authSignOut();
  }
}

async function handleTranscriptReady(video: Video): Promise<void> {
  await setLastVideo({ videoId: video.videoId, title: video.title, channelName: video.channelName });
  await storeVideo(video);
  const cached = await hasResult(video.videoId);
  if (cached) {
    const result = await getResult(video.videoId);
    if (result) {
      const msg: AnalysisResultMessage = {
        type: MessageType.ANALYSIS_RESULT,
        result,
      };
      broadcastToSidePanel(msg);
      return;
    }
  }

  try {
    const result = await postAnalysis(video);
    await setResult(video.videoId, result);
    const msg: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      result,
    };
    broadcastToSidePanel(msg);
  } catch (err) {
    const errDetail = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[background] postAnalysis failed:", errDetail);
    const panelError = mapToAnalysisError(err);
    if (panelError.code === "rate-limited") {
      await sleep(10_000);
    }
    const errorMsg: AnalysisErrorMessage = {
      type: MessageType.ANALYSIS_ERROR,
      error: panelError,
    };
    broadcastToSidePanel(errorMsg);
  }
}

async function handleNoTranscript(videoId: string): Promise<void> {
  const errorMsg: AnalysisErrorMessage = {
    type: MessageType.ANALYSIS_ERROR,
    error: {
      code: "unknown",
      message: "This video doesn't have captions available.",
      action: "Try a video with captions enabled.",
      retryable: false,
    },
  };
  broadcastToSidePanel(errorMsg);
  void videoId;
}

async function handleRetryAnalysis(videoId: string): Promise<void> {
  const lastVideo = await getLastVideo();

  try {
    const result = await postAnalysis({
      videoId,
      title: lastVideo?.title ?? "",
      channelName: lastVideo?.channelName ?? "",
      url: "",
      durationSeconds: 0,
      transcript: "",
    });
    await setResult(videoId, result);
    const msg: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      result,
    };
    broadcastToSidePanel(msg);
  } catch (err) {
    const panelError = mapToAnalysisError(err);
    const errorMsg: AnalysisErrorMessage = {
      type: MessageType.ANALYSIS_ERROR,
      error: panelError,
    };
    broadcastToSidePanel(errorMsg);
  }
}

function mapToAnalysisError(err: unknown): PanelError {
  if (isPanelError(err)) return err;
  return {
    code: "unknown",
    message: "An unexpected error occurred.",
    action: "Try again.",
    retryable: true,
  };
}

function isPanelError(err: unknown): err is PanelError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    "retryable" in err
  );
}

function broadcastToSidePanel(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
