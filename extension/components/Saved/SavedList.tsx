import { useEffect, useState } from "react";
import { listSavedVideos } from "../../services/savedVideosClient";
import { LoadingIndicator } from "../shared/LoadingIndicator";
import type { SavedVideoSummary } from "../../types/index";

interface SavedListProps {
  onSelect: (videoId: string) => void;
}

type ListStatus = "loading" | "ready" | "error";

export function SavedList({ onSelect }: SavedListProps) {
  const [videos, setVideos] = useState<SavedVideoSummary[]>([]);
  const [status, setStatus] = useState<ListStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    void listSavedVideos()
      .then((result) => {
        if (cancelled) return;
        setVideos(result);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <LoadingIndicator />;
  }

  if (status === "error") {
    return (
      <div className="p-4">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Could not load your saved videos. Please try again.
        </p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No saved videos yet</p>
        <p role="note" aria-label="Save a video to see it here" className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          Save a video&apos;s summary and chat from the Summary or Chat tab to find it here later.
        </p>
      </div>
    );
  }

  return (
    <ul aria-label="Saved videos" className="flex flex-col gap-1 p-2">
      {videos.map((video) => (
        <li key={video.videoId}>
          <button
            type="button"
            onClick={() => onSelect(video.videoId)}
            aria-label={`Open saved video: ${video.videoTitle}`}
            className="flex w-full flex-col items-start rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <span className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {video.videoTitle}
            </span>
            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{video.channelName}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
