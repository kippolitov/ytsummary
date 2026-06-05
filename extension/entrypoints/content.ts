import { extractTranscript } from "../services/transcriptExtractor";
import { MessageType } from "../types/messages";
import type {
  TranscriptReadyMessage,
  NoTranscriptMessage,
  VideoChangedMessage,
} from "../types/messages";
import type { Video } from "../types/index";

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  runAt: "document_idle",
  main() {
    void analyzeCurrentVideo();

    window.addEventListener("yt-navigate-finish", () => {
      const videoId = extractVideoId();
      if (!videoId) return;

      const changedMsg: VideoChangedMessage = {
        type: MessageType.VIDEO_CHANGED,
        videoId,
      };
      chrome.runtime.sendMessage(changedMsg);

      void analyzeCurrentVideo();
    });
  },
});

function extractVideoId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

interface YtPlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
  };
}

function getPlayerResponse(): YtPlayerResponse | null {
  const w = globalThis as unknown as { ytInitialPlayerResponse?: YtPlayerResponse };
  return w.ytInitialPlayerResponse ?? null;
}

async function analyzeCurrentVideo(): Promise<void> {
  const videoId = extractVideoId();
  if (!videoId) return;

  const playerResponse = getPlayerResponse();
  const details = playerResponse?.videoDetails;

  const transcript = await extractTranscript();

  if (!transcript) {
    const msg: NoTranscriptMessage = {
      type: MessageType.NO_TRANSCRIPT,
      videoId,
    };
    chrome.runtime.sendMessage(msg);
    return;
  }

  const video: Video = {
    videoId,
    title: details?.title ?? "",
    channelName: details?.author ?? "",
    url: window.location.href,
    durationSeconds: details?.lengthSeconds ? parseInt(details.lengthSeconds, 10) : 0,
    transcript,
  };

  const msg: TranscriptReadyMessage = {
    type: MessageType.TRANSCRIPT_READY,
    video,
  };
  chrome.runtime.sendMessage(msg);
}
