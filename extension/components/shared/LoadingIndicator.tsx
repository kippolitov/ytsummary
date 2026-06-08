export function LoadingIndicator() {
  return (
    <div
      role="status"
      aria-label="Analyzing video, please wait"
      aria-live="polite"
      className="flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="relative">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Analyzing video…</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">This may take a few seconds</p>
    </div>
  );
}
