import type { Reference } from "../../types/index";

interface ReferencesSectionProps {
  references: Reference[];
}

export function ReferencesSection({ references }: ReferencesSectionProps) {
  if (references.length === 0) return null;

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        References
      </h2>
      <ul className="space-y-4">
        {references.map((ref, index) => (
          <li key={index} className="text-sm">
            <div className="font-semibold text-gray-900">
              {ref.url ? (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  aria-label={`${ref.name} — opens in new tab`}
                >
                  {ref.name}
                </a>
              ) : (
                ref.name
              )}
            </div>
            <p className="mt-0.5 text-gray-600">{ref.description}</p>
            <p className="mt-0.5 text-xs italic text-gray-400">{ref.context}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
