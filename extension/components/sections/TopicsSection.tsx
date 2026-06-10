import type { Topic } from "../../types/index";

interface TopicsSectionProps {
  topics: Topic[];
}

export function TopicsSection({ topics }: TopicsSectionProps) {
  if (topics.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Topics
      </h2>
      <ul className="space-y-5">
        {topics.map((topic, index) => (
          <li key={index} className="text-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{topic.name}</h3>
            <p className="mt-1.5 text-gray-600 dark:text-gray-400">{topic.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
