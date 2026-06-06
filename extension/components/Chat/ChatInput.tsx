import { useState, useRef, useEffect } from "react";

const MAX_CHARS = 2000;

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
}

export function ChatInput({ onSubmit, disabled = false, prefill }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (prefill) {
      setValue(prefill);
      textareaRef.current?.focus();
    }
  }, [prefill]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const remaining = MAX_CHARS - value.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS + 10))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={3}
          placeholder="Ask a question about this video…"
          aria-label="Chat message input"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-xs ${isOverLimit ? "text-red-500" : remaining < 100 ? "text-amber-500" : "text-gray-400"}`}
            aria-live="polite"
          >
            {remaining < 200 ? `${remaining} characters remaining` : ""}
          </span>
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || isOverLimit}
            aria-label="Send message"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
