import { MessageType } from "../types/messages";
import type {
  ExtensionMessage,
  TranscriptReadyMessage,
  VideoChangedMessage,
} from "../types/messages";
import type { Video } from "../types/index";

export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  runAt: "document_idle",
  main() {
    // Background only sends this after the side panel is open — relay it
    // into the page's MAIN world, which is where extraction actually runs.
    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === MessageType.REQUEST_TRANSCRIPT) {
        window.postMessage({ type: "YTKP_REQUEST_TRANSCRIPT" }, "*");
      }
    });

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data?.type) return;

      if (data.type === "YT_VIDEO_CHANGED") {
        const msg: VideoChangedMessage = {
          type: MessageType.VIDEO_CHANGED,
          videoId: data.videoId as string,
        };
        chrome.runtime.sendMessage(msg).catch(() => {});
      } else if (data.type === "YT_TRANSCRIPT") {
        const video: Video = {
          videoId: data.videoId as string,
          title: getVideoTitle(),
          channelName: getChannelName(),
          url: window.location.href,
          durationSeconds: 0,
          transcript: (data.transcript as string) ?? "",
        };
        const msg: TranscriptReadyMessage = {
          type: MessageType.TRANSCRIPT_READY,
          video,
        };
        chrome.runtime.sendMessage(msg).catch(() => {});
      }
    });
  },
});

function getVideoTitle(): string {
  return document.title.replace(/\s*[-–]\s*YouTube\s*$/, "").trim();
}

function getChannelName(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[itemprop="author"]');
  if (meta?.content) return meta.content;
  const link = document.querySelector<HTMLLinkElement>('link[itemprop="name"]');
  return link?.getAttribute("content") ?? "";
}
