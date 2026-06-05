interface SummarySectionProps {
  summary: string;
}

export function SummarySection({ summary }: SummarySectionProps) {
  if (!summary) return null;

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Summary
      </h2>
      <p className="text-sm leading-relaxed text-gray-800">{summary}</p>
    </section>
  );
}
