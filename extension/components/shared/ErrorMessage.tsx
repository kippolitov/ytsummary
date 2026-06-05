import type { PanelError } from "../../types/index";

interface ErrorMessageProps {
  error: PanelError;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="rounded-lg bg-red-50 p-4"
    >
      <p className="text-sm font-semibold text-red-800">{error.message}</p>
      <p className="mt-1 text-sm text-red-700">{error.action}</p>
      {error.retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry analysis"
          className="mt-3 rounded bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        >
          Retry
        </button>
      )}
    </div>
  );
}
