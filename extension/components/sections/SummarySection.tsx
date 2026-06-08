interface SummarySectionProps {
  summary: string;
}

export function SummarySection({ summary }: SummarySectionProps) {
  if (!summary) return null;

  return (
    <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Summary
      </h2>
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{summary}</p>
    </section>
  );
}
