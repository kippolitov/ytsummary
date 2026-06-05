import { useEffect, useState } from "react";
import { KnowledgePanel } from "../../components/KnowledgePanel/KnowledgePanel";
import { LoadingIndicator } from "../../components/shared/LoadingIndicator";
import { ErrorMessage } from "../../components/shared/ErrorMessage";
import { MessageType } from "../../types/messages";
import type { ExtensionMessage } from "../../types/messages";
import type { KnowledgePanelState } from "../../types/index";

const INITIAL_STATE: KnowledgePanelState = {
  videoId: "",
  status: "loading",
  result: null,
  error: null,
  analyzedAt: null,
};

export function App() {
  const [state, setState] = useState<KnowledgePanelState>(INITIAL_STATE);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");

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
