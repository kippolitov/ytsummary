import { useEffect, useState } from "react";
import { KnowledgePanel } from "../../components/KnowledgePanel/KnowledgePanel";
import { LoadingIndicator } from "../../components/shared/LoadingIndicator";
import { ErrorMessage } from "../../components/shared/ErrorMessage";
import { TabBar } from "../../components/shared/TabBar";
import { ChatPanel } from "../../components/Chat/ChatPanel";
import { SignInGate } from "../../components/Auth/SignInGate";
import { SavedList } from "../../components/Saved/SavedList";
import { SavedVideoDetail } from "../../components/Saved/SavedVideoDetail";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { getLastVideo, getResult } from "../../services/sessionCache";
import { MessageType } from "../../types/messages";
import type { ExtensionMessage } from "../../types/messages";
import type { KnowledgePanelState } from "../../types/index";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "chat", label: "Chat" },
  { id: "saved", label: "Saved" },
];

const INITIAL_STATE: KnowledgePanelState = {
  videoId: "",
  status: "idle",
  result: null,
  error: null,
  analyzedAt: null,
};

export function App() {
  const { preference, cycleTheme } = useTheme();
  const auth = useAuth();
  const [state, setState] = useState<KnowledgePanelState>(INITIAL_STATE);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [selectedSavedVideoId, setSelectedSavedVideoId] = useState<string | null>(null);

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
        setActiveTab("summary");
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
    <main className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200/70 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* YouTube-red dot indicator */}
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
            aria-hidden="true"
          />
          <span className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
            {videoTitle
              ? videoTitle.length > 38
                ? videoTitle.slice(0, 38) + "…"
                : videoTitle
              : "YouTube AI"}
          </span>
        </div>
        <button
          onClick={cycleTheme}
          title={`Theme: ${preference} — click to cycle`}
          aria-label={`Current theme: ${preference}. Click to change.`}
          className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          {preference === "light" && (
            /* Sun */
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
          {preference === "dark" && (
            /* Moon */
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          {preference === "system" && (
            /* Monitor / auto */
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          )}
        </button>
        <button
          onClick={handleRetry}
          title="Refresh summary"
          aria-label="Refresh summary"
          disabled={state.status === "loading"}
          className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={state.status === "loading" ? "animate-spin" : ""}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        {auth.status === "signed-in" && (
          <button
            onClick={() => void auth.signOut()}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </header>

      <SignInGate auth={auth} onSignIn={() => void auth.signIn()} onSignOut={() => void auth.signOut()}>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === "summary" && (
            <div
              id="panel-summary"
              role="tabpanel"
              aria-labelledby="tab-summary"
              className="h-full overflow-y-auto"
            >
              {state.status === "idle" && (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Open a YouTube video</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">The summary will appear here automatically.</p>
                </div>
              )}
              {state.status === "loading" && <LoadingIndicator />}
              {state.status === "ready" && state.result && (
                <KnowledgePanel result={state.result} videoTitle={videoTitle} channelName={channelName} />
              )}
              {state.status === "error" && state.error && (
                <div className="p-4">
                  <ErrorMessage error={state.error} onRetry={handleRetry} />
                </div>
              )}
              {state.status === "no-transcript" && (
                <div className="p-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">No captions available</p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-500">
                      This video doesn&apos;t have captions. Try a video with captions enabled.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div
              id="panel-chat"
              role="tabpanel"
              aria-labelledby="tab-chat"
              className="h-full"
            >
              <ChatPanel videoId={state.videoId} />
            </div>
          )}

          {activeTab === "saved" && (
            <div
              id="panel-saved"
              role="tabpanel"
              aria-labelledby="tab-saved"
              className="h-full overflow-hidden"
            >
              {selectedSavedVideoId ? (
                <SavedVideoDetail
                  videoId={selectedSavedVideoId}
                  onBack={() => setSelectedSavedVideoId(null)}
                  onUnsaved={() => setSelectedSavedVideoId(null)}
                />
              ) : (
                <div className="h-full overflow-y-auto">
                  <SavedList onSelect={setSelectedSavedVideoId} />
                </div>
              )}
            </div>
          )}
        </div>
      </SignInGate>
    </main>
  );
}
