import type { Reference } from "../../types/index";

interface ReferencesSectionProps {
  references: Reference[];
}

export function ReferencesSection({ references }: ReferencesSectionProps) {
  if (references.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        References
      </h2>
      <ul className="space-y-4">
        {references.map((ref, index) => (
          <li key={index} className="text-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {ref.url ? (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-blue-400 dark:hover:text-blue-300"
                  aria-label={`${ref.name} — opens in new tab`}
                >
                  {ref.name}
                </a>
              ) : (
                ref.name
              )}
            </div>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">{ref.description}</p>
            <p className="mt-0.5 text-xs italic text-gray-400 dark:text-gray-600">{ref.context}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
