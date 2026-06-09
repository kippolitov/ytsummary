import { postAnalysis } from "../services/analysisClient";
import { getResult, hasResult, setResult, setLastVideo, getLastVideo, storeVideo } from "../services/sessionCache";
import { MessageType } from "../types/messages";
import type {
  ExtensionMessage,
  AnalysisResultMessage,
  AnalysisErrorMessage,
} from "../types/messages";
import type { PanelError, Video } from "../types/index";

export default defineBackground({
  main() {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
  },
});

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
    console.error("[background] postAnalysis failed:", err);
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
