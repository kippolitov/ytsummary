export function LoadingIndicator() {
  return (
    <div
      role="status"
      aria-label="Analyzing video, please wait"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
        aria-hidden="true"
      />
      <p className="mt-4 text-sm text-gray-500">Analyzing video…</p>
    </div>
  );
}
