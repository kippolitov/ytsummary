import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../../types/chat";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ message, isStreaming = false }: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access may be restricted
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end px-3 py-1" aria-label="Your message">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-sm leading-relaxed text-white shadow-sm dark:bg-blue-700">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1" aria-label="Assistant response">
      <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700/60">
        <div className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-200">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {isStreaming && (
          <span
            className="ml-0.5 inline-block h-3.5 w-0.5 animate-blink rounded-sm bg-gray-500 align-middle dark:bg-gray-400"
            aria-label="Generating response"
          />
        )}
      </div>
      {!isStreaming && message.type === "blog-post" && (
        <div className="mt-1.5 flex justify-end">
          <button
            onClick={() => void handleCopy()}
            aria-label="Copy blog post to clipboard"
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
