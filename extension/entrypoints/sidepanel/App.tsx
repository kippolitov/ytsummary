import { useEffect, useState } from "react";
import { KnowledgePanel } from "../../components/KnowledgePanel/KnowledgePanel";
import { LoadingIndicator } from "../../components/shared/LoadingIndicator";
import { ErrorMessage } from "../../components/shared/ErrorMessage";
import { getLastVideo, getResult } from "../../services/sessionCache";
import { MessageType } from "../../types/messages";
import type { ExtensionMessage } from "../../types/messages";
import type { KnowledgePanelState } from "../../types/index";

const INITIAL_STATE: KnowledgePanelState = {
  videoId: "",
  status: "idle",
  result: null,
  error: null,
  analyzedAt: null,
};

export function App() {
  const [state, setState] = useState<KnowledgePanelState>(INITIAL_STATE);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");

  useEffect(() => {
    async function hydrate() {
      const video = await getLastVideo();
      if (!video) return;
      const result = await getResult(video.videoId);
      if (result) {
        setVideoTitle(video.title);
        setChannelName(video.channelName);
        setState({
          videoId: video.videoId,
          status: "ready",
          result,
          error: null,
          analyzedAt: result.analyzedAt,
        });
      } else {
        setState((prev) => ({ ...prev, videoId: video.videoId, status: "loading" }));
      }
    }
    void hydrate();
  }, []);

  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === MessageType.ANALYSIS_RESULT) {
        setState((prev) => ({
          ...prev,
          videoId: message.result.videoId,
          status: "ready",
          result: message.result,
          error: null,
          analyzedAt: message.result.analyzedAt,
        }));
      } else if (message.type === MessageType.ANALYSIS_ERROR) {
        if (message.error.code === "unknown" && !message.error.retryable) {
          setState((prev) => ({
            ...prev,
            status: "no-transcript",
            error: message.error,
            result: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: message.error,
            result: null,
          }));
        }
      } else if (message.type === MessageType.VIDEO_CHANGED) {
        setState({
          videoId: message.videoId,
          status: "loading",
          result: null,
          error: null,
          analyzedAt: null,
        });
        setVideoTitle("");
        setChannelName("");
      } else if (message.type === MessageType.TRANSCRIPT_READY) {
        setVideoTitle(message.video.title);
        setChannelName(message.video.channelName);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleRetry = () => {
    if (!state.videoId) return;
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    chrome.runtime.sendMessage({
      type: MessageType.RETRY_ANALYSIS,
      videoId: state.videoId,
    });
  };

  return (
    <main className="min-h-screen max-w-panel bg-gray-50" style={{ width: "400px" }}>
      <div className="flex items-center justify-end border-b border-gray-100 px-3 py-1">
        <button
          onClick={handleRetry}
          title="Refresh summary"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          disabled={state.status === "loading"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>

      {state.status === "idle" && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-gray-500">Navigate to a YouTube video to analyze it.</p>
        </div>
      )}

      {state.status === "loading" && <LoadingIndicator />}

      {state.status === "ready" && state.result && (
        <KnowledgePanel
          result={state.result}
          videoTitle={videoTitle}
          channelName={channelName}
        />
      )}

      {state.status === "error" && state.error && (
        <div className="p-4">
          <ErrorMessage error={state.error} onRetry={handleRetry} />
        </div>
      )}

      {state.status === "no-transcript" && (
        <div className="p-4">
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              No captions available
            </p>
            <p className="mt-1 text-sm text-amber-700">
              This video doesn't have captions. Try a video with captions enabled.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
