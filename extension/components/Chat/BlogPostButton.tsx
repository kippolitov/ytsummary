interface BlogPostButtonProps {
  onGenerate: () => void;
  disabled?: boolean;
}

export function BlogPostButton({ onGenerate, disabled = false }: BlogPostButtonProps) {
  return (
    <div className="shrink-0 px-3 pb-1.5">
      <button
        onClick={onGenerate}
        disabled={disabled}
        aria-label="Generate blog post from this video"
        className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Generate Blog Post
      </button>
    </div>
  );
}
