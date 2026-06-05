import type { Topic } from "../../types/index";

interface TopicsSectionProps {
  topics: Topic[];
}

export function TopicsSection({ topics }: TopicsSectionProps) {
  if (topics.length === 0) return null;

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Topics
      </h2>
      <ul className="space-y-3">
        {topics.map((topic, index) => (
          <li key={index} className="text-sm">
            <span className="font-semibold text-gray-900">{topic.name}</span>
            <p className="mt-0.5 text-gray-600">{topic.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
