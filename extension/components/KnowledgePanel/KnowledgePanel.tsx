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
    <div className="flex flex-col gap-3 p-3">
      {(videoTitle || channelName) && (
        <header className="border-b border-gray-100 pb-2">
          {videoTitle && (
            <h1 className="line-clamp-2 text-sm font-semibold text-gray-900">
              {videoTitle}
            </h1>
          )}
          {channelName && (
            <p className="mt-0.5 text-xs text-gray-500">{channelName}</p>
          )}
        </header>
      )}
      <SummarySection summary={result.summary} />
      <TopicsSection topics={result.topics} />
      <StepsSection steps={result.steps} />
      <ReferencesSection references={result.references} />
    </div>
  );
}
