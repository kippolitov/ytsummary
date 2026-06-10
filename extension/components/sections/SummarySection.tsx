interface SummarySectionProps {
  tldr: string[];
}

export function SummarySection({ tldr }: SummarySectionProps) {
  if (tldr.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        TL;DR
      </h2>
      <ul aria-label="Key takeaways" className="space-y-1.5">
        {tldr.map((bullet, index) => (
          <li key={index} className="flex gap-2 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>
    </section>
  );
}
