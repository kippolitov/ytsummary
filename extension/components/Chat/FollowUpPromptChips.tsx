interface FollowUpPromptChipsProps {
  prompts: string[];
  isLoading: boolean;
  onSelect: (prompt: string) => void;
}

export function FollowUpPromptChips({ prompts, isLoading, onSelect }: FollowUpPromptChipsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-skeleton="true"
            className="h-7 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (prompts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/60"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
