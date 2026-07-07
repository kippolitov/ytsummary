import type { AnalysisResult, PanelError, ErrorCode } from "../types/index";
import type { Video } from "../types/index";
import { getIdToken } from "./authClient";

declare const WXT_AZURE_FUNCTION_URL: string;
declare const WXT_AZURE_FUNCTION_KEY: string;

const TIMEOUT_MS = 45_000;

interface AnalyzeRequestBody {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  durationSeconds: number;
}

export async function postAnalysis(video: Video): Promise<AnalysisResult> {
  const body: AnalyzeRequestBody = {
    videoId: video.videoId,
    title: video.title,
    channelName: video.channelName,
    transcript: video.transcript,
    durationSeconds: video.durationSeconds,
  };

  if (!WXT_AZURE_FUNCTION_URL) {
    throw makePanelError("service-error", "The analysis service is not configured.", "Please reinstall the extension.", false);
  }
  const endpoint = new URL(WXT_AZURE_FUNCTION_URL);
  if (WXT_AZURE_FUNCTION_KEY) {
    endpoint.searchParams.set("code", WXT_AZURE_FUNCTION_KEY);
  }

  const idToken = await getIdToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw makePanelError("network-error", "Could not reach the analysis service.", "Check your internet connection and try again.", true);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.ok) {
    return (await response.json()) as AnalysisResult;
  }

  throw mapHttpError(response.status);
}

function mapHttpError(status: number): PanelError {
  if (status === 401) {
    return makePanelError("unauthenticated", "Sign in with Google to continue.", "Sign in and try again.", false);
  }
  if (status === 403) {
    return makePanelError("not-authorized", "Access to this extension is invitation-only.", "Contact the developer for access.", false);
  }
  if (status === 400 || status === 422) {
    const code: ErrorCode = status === 422 ? "transcript-too-long" : "unknown";
    return makePanelError(code, "The video could not be analyzed.", "Try a shorter video or check captions are available.", false);
  }
  if (status === 429) {
    return makePanelError("rate-limited", "The service is temporarily busy.", "Try again in a moment.", true);
  }
  if (status === 500 || status === 503) {
    return makePanelError("service-error", "The analysis service encountered an error.", "Try again.", true);
  }
  return makePanelError("unknown", "An unexpected error occurred.", "Try again.", true);
}

function makePanelError(
  code: ErrorCode,
  message: string,
  action: string,
  retryable: boolean
): PanelError {
  return { code, message, action, retryable };
}
