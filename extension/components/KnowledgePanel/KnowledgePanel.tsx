import type { AnalysisResult } from "../../types/index";
import { SummarySection } from "../sections/SummarySection";
import { TopicsSection } from "../sections/TopicsSection";
import { StepsSection } from "../sections/StepsSection";
import { ReferencesSection } from "../sections/ReferencesSection";

interface KnowledgePanelProps {
  result: AnalysisResult;
  videoTitle?: string;
  channelName?: string;
}

export function KnowledgePanel({ result, videoTitle, channelName }: KnowledgePanelProps) {
  return (
    <div className="flex flex-col gap-2.5 p-3">
      {(videoTitle || channelName) && (
        <header className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          {videoTitle && (
            <h1 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {videoTitle}
            </h1>
          )}
          {channelName && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{channelName}</p>
          )}
        </header>
      )}
      <SummarySection tldr={result.tldr} />
      <TopicsSection topics={result.topics} />
      <StepsSection steps={result.steps} />
      <ReferencesSection references={result.references} />
    </div>
  );
}
