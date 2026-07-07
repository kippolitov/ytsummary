import { useEffect, useState } from "react";
import { KnowledgePanel } from "../KnowledgePanel/KnowledgePanel";
import { ChatPanel } from "../Chat/ChatPanel";
import { LoadingIndicator } from "../shared/LoadingIndicator";
import { TabBar } from "../shared/TabBar";
import { getSavedVideo, deleteSavedVideo, saveVideo } from "../../services/savedVideosClient";
import { setResult, storeVideo } from "../../services/sessionCache";
import { saveChatSession } from "../../services/chatCache";
import type { SavedVideoDetail as SavedVideoDetailData } from "../../types/index";
import type { ChatMessage } from "../../types/chat";

interface SavedVideoDetailProps {
  videoId: string;
  onBack: () => void;
  onUnsaved: () => void;
}

type LoadStatus = "loading" | "ready" | "not-found" | "error";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "chat", label: "Chat" },
];

export function SavedVideoDetail({ videoId, onBack, onUnsaved }: SavedVideoDetailProps) {
  const [detail, setDetail] = useState<SavedVideoDetailData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [isUnsaving, setIsUnsaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDetail(null);

    void getSavedVideo(videoId)
      .then(async (fetched) => {
        if (cancelled) return;
        if (!fetched) {
          setStatus("not-found");
          return;
        }
        const now = Date.now();
        await Promise.all([
          storeVideo({
            videoId,
            title: fetched.videoTitle,
            channelName: fetched.channelName,
            url: fetched.videoUrl,
            durationSeconds: fetched.durationSeconds,
            transcript: "",
          }),
          setResult(videoId, fetched.summary),
          saveChatSession({ videoId, messages: fetched.messages, createdAt: now, updatedAt: now }),
        ]);
        if (cancelled) return;
        setDetail(fetched);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const handleMessagesUpdated = (messages: ChatMessage[]) => {
    if (!detail) return;
    void saveVideo(videoId, {
      videoTitle: detail.videoTitle,
      channelName: detail.channelName,
      videoUrl: detail.videoUrl,
      durationSeconds: detail.durationSeconds,
      summary: detail.summary,
      messages,
    }).catch(() => {
      // Non-blocking: the message is still visible locally even if the re-save fails.
    });
  };

  const handleUnsave = async () => {
    setIsUnsaving(true);
    try {
      await deleteSavedVideo(videoId);
      onUnsaved();
    } finally {
      setIsUnsaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200/70 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to saved videos"
          className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← Back
        </button>
        {status === "ready" && (
          <button
            type="button"
            onClick={() => void handleUnsave()}
            disabled={isUnsaving}
            aria-label="Remove from saved videos"
            className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {isUnsaving ? "Removing…" : "Unsave"}
          </button>
        )}
      </div>

      {status === "loading" && <LoadingIndicator />}

      {status === "not-found" && (
        <p role="alert" className="p-4 text-sm text-gray-600 dark:text-gray-400">
          This saved video could not be found.
        </p>
      )}

      {status === "error" && (
        <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">
          Could not load this saved video. Please try again.
        </p>
      )}

      {status === "ready" && detail && (
        <>
          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === "summary" && (
              <div className="h-full overflow-y-auto">
                <KnowledgePanel
                  result={detail.summary}
                  videoTitle={detail.videoTitle}
                  channelName={detail.channelName}
                />
              </div>
            )}
            {activeTab === "chat" && (
              <ChatPanel videoId={videoId} onMessagesUpdated={handleMessagesUpdated} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
