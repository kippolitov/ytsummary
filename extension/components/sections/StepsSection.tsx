import type { ImplementationStep } from "../../types/index";

interface StepsSectionProps {
  steps: ImplementationStep[];
}

export function StepsSection({ steps }: StepsSectionProps) {
  if (steps.length === 0) return null;

  return (
    <section aria-label="Steps" className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Steps
      </h2>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.order} className="flex gap-3 text-sm">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
            >
              {step.order}
            </span>
            <span className="text-gray-800">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
