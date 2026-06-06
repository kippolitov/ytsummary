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
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1" aria-label="Assistant response">
      <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-gray-500" aria-label="Generating response" />
        )}
      </div>
      {!isStreaming && message.type === "blog-post" && (
        <div className="mt-1 flex justify-end">
          <button
            onClick={() => void handleCopy()}
            aria-label="Copy blog post to clipboard"
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
