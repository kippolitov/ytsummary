import type { PanelError } from "../../types/index";

interface ErrorMessageProps {
  error: PanelError;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30"
    >
      <p className="text-sm font-semibold text-red-800 dark:text-red-400">{error.message}</p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-500">{error.action}</p>
      {error.retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry analysis"
          className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
        >
          Retry
        </button>
      )}
    </div>
  );
}
