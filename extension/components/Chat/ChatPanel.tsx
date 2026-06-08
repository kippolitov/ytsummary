import { useEffect, useRef, useState } from "react";
import { getChatSession, saveChatSession } from "../../services/chatCache";
import { getVideo } from "../../services/sessionCache";
import { sendChatMessage } from "../../services/chatClient";
import type { ChatMessage, ChatSession, ChatHistoryItem, ChatMessageType } from "../../types/chat";
import type { Video } from "../../types/index";
import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { BlogPostButton } from "./BlogPostButton";

interface ChatPanelProps {
  videoId: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function ChatPanel({ videoId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputPrefill, setInputPrefill] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    async function load() {
      const [session, vid] = await Promise.all([
        getChatSession(videoId),
        getVideo(videoId),
      ]);
      setMessages(session?.messages ?? []);
      setVideo(vid);
    }
    void load();

    return () => {
      abortRef.current = true;
    };
  }, [videoId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const persistSession = async (updatedMessages: ChatMessage[]) => {
    const now = Date.now();
    const existing = await getChatSession(videoId);
    const session: ChatSession = {
      videoId,
      messages: updatedMessages,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveChatSession(session);
  };

  const handleSend = async (text: string, mode: ChatMessageType = "chat") => {
    if (!video || isStreaming) return;
    setError(null);
    abortRef.current = false;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: mode === "blog-post" ? "Generate Blog Post" : text,
      type: mode,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);

    const assistantId = generateId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      type: mode,
      timestamp: Date.now(),
    };
    setStreamingMessage(assistantPlaceholder);
    setIsStreaming(true);

    const historyForApi: ChatHistoryItem[] = updatedWithUser.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let accumulated = "";
    try {
      const gen = sendChatMessage({
        videoId,
        videoTitle: video.title,
        transcript: video.transcript,
        messages: historyForApi,
        mode,
      });

      for await (const delta of gen) {
        if (abortRef.current) break;
        accumulated += delta;
        setStreamingMessage((prev) =>
          prev ? { ...prev, content: accumulated } : null
        );
      }
    } catch (err) {
      const panelErr = err as { message?: string };
      setError(panelErr.message ?? "Something went wrong. Please try again.");
    }

    const finalMsg: ChatMessage = { ...assistantPlaceholder, content: accumulated };
    const updatedAll = [...updatedWithUser, finalMsg];
    setMessages(updatedAll);
    setStreamingMessage(null);
    setIsStreaming(false);

    if (accumulated) {
      await persistSession(updatedAll);
    }
  };

  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Chat is unavailable
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          This video has no transcript. Try a video with captions enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-blue-400" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask anything about this video</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
              Questions, summaries, deep dives — the transcript is your context.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === "assistant" &&
            idx === messages.length - 1 &&
            !streamingMessage &&
            !isStreaming;
          return (
            <div key={msg.id}>
              <ChatMessageBubble message={msg} />
              {isLastAssistant && (
                <div className="px-3 pb-1">
                  <button
                    onClick={() => setInputPrefill("Can you dive deeper into this topic?")}
                    aria-label="Dive deeper into this topic"
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/60"
                  >
                    Dive Deeper
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {streamingMessage && (
          <ChatMessageBubble message={streamingMessage} isStreaming={true} />
        )}

        {error && (
          <div className="mx-3 my-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <BlogPostButton
        onGenerate={() => void handleSend("", "blog-post")}
        disabled={isStreaming}
      />

      <ChatInput
        onSubmit={(text) => { setInputPrefill(undefined); void handleSend(text); }}
        disabled={isStreaming}
        prefill={inputPrefill}
      />
    </div>
  );
}
