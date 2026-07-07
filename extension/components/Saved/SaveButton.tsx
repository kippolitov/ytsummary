import { useEffect, useState } from "react";
import { getVideo, getResult } from "../../services/sessionCache";
import { getChatSession } from "../../services/chatCache";
import { saveVideo, getSavedVideo } from "../../services/savedVideosClient";
import type { SavedVideoError } from "../../services/savedVideosClient";

type SaveState = "checking" | "idle" | "saving" | "saved" | "error" | "limit-reached";

interface SaveButtonProps {
  videoId: string;
}

export function SaveButton({ videoId }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("checking");
    setErrorMessage(null);

    void getSavedVideo(videoId)
      .then((saved) => {
        if (!cancelled) setState(saved ? "saved" : "idle");
      })
      .catch(() => {
        if (!cancelled) setState("idle");
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const handleSave = async () => {
    setState("saving");
    setErrorMessage(null);

    try {
      const [video, summary, session] = await Promise.all([
        getVideo(videoId),
        getResult(videoId),
        getChatSession(videoId),
      ]);

      if (!video || !summary) {
        setState("error");
        setErrorMessage("Nothing to save yet — generate a summary first.");
        return;
      }

      await saveVideo(videoId, {
        videoTitle: video.title,
        channelName: video.channelName,
        videoUrl: video.url,
        durationSeconds: video.durationSeconds,
        summary,
        messages: session?.messages ?? [],
      });
      setState("saved");
    } catch (err) {
      const saveError = err as SavedVideoError;
      if (saveError?.code === "saved-video-limit-reached") {
        setState("limit-reached");
        setErrorMessage("You have 200 saved videos. Remove a saved video first.");
      } else {
        setState("error");
        setErrorMessage(saveError?.message ?? "Save did not complete. Please try again.");
      }
    }
  };

  if (state === "checking") {
    return null;
  }

  if (state === "saved") {
    return (
      <button
        type="button"
        disabled
        aria-label="Video saved"
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Saved
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={state === "saving"}
        aria-label={state === "saving" ? "Saving video" : "Save video"}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        {state === "saving" ? "Saving…" : "Save"}
      </button>
      {(state === "error" || state === "limit-reached") && errorMessage && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
