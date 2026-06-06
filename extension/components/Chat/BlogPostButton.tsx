interface BlogPostButtonProps {
  onGenerate: () => void;
  disabled?: boolean;
}

export function BlogPostButton({ onGenerate, disabled = false }: BlogPostButtonProps) {
  return (
    <button
      onClick={onGenerate}
      disabled={disabled}
      aria-label="Generate blog post from this video"
      className="mx-3 mb-2 flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      Generate Blog Post
    </button>
  );
}
