export interface AnalyzeRequest {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  durationSeconds: number;
}

export interface Topic {
  name: string;
  description: string;
  timestampSeconds: number | null;
}

export interface ImplementationStep {
  order: number;
  text: string;
  timestampSeconds: number | null;
}

export interface Reference {
  name: string;
  description: string;
  url: string | null;
  context: string;
}

export interface AnalyzeResponse {
  videoId: string;
  summary: string;
  topics: Topic[];
  steps: ImplementationStep[];
  references: Reference[];
  analyzedAt: string;
}

export interface FunctionError {
  error: {
    code: string;
    message: string;
  };
}

export function isAnalyzeRequest(body: unknown): body is AnalyzeRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.videoId === "string" &&
    /^[a-zA-Z0-9_-]{11}$/.test(b.videoId) &&
    typeof b.title === "string" &&
    b.title.length > 0 &&
    b.title.length <= 500 &&
    typeof b.channelName === "string" &&
    b.channelName.length > 0 &&
    b.channelName.length <= 200 &&
    typeof b.transcript === "string" &&
    b.transcript.length > 0 &&
    typeof b.durationSeconds === "number" &&
    b.durationSeconds > 0
  );
}
