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
    <div className="shrink-0 border-t border-gray-200/70 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 transition-colors focus-within:border-blue-500 focus-within:bg-white dark:border-gray-700 dark:bg-gray-800/60 dark:focus-within:border-blue-500 dark:focus-within:bg-gray-800">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS + 10))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
          placeholder="Ask a question about this video…"
          aria-label="Chat message input"
          className="min-h-[2.5rem] flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:text-gray-400 dark:text-gray-200 dark:placeholder-gray-600 dark:disabled:text-gray-600"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          {remaining < 200 && (
            <span
              className={`text-xs ${isOverLimit ? "text-red-500" : remaining < 100 ? "text-amber-500 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}
              aria-live="polite"
            >
              {remaining}
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || isOverLimit}
            aria-label="Send message"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-1 px-1 text-[10px] text-gray-400 dark:text-gray-600">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
