import type { AnalysisResult, SavedVideoDetail, SavedVideoSummary } from "../types/index";
import type { ChatMessage } from "../types/chat";
import { getIdToken } from "./authClient";

declare const WXT_AZURE_FUNCTION_URL: string;
declare const WXT_AZURE_FUNCTION_KEY: string;

const TIMEOUT_MS = 20_000;

export type SavedVideoErrorCode =
  | "network-error"
  | "service-error"
  | "unauthenticated"
  | "not-authorized"
  | "not-found"
  | "saved-video-limit-reached"
  | "unknown";

export interface SavedVideoError {
  code: SavedVideoErrorCode;
  message: string;
}

export interface SaveVideoInput {
  videoTitle: string;
  channelName: string;
  videoUrl: string;
  durationSeconds: number;
  summary: AnalysisResult;
  messages: ChatMessage[];
}

function buildUrl(path: string): string {
  if (!WXT_AZURE_FUNCTION_URL) {
    throw makeError("service-error", "The saved-videos service is not configured.");
  }
  const base = WXT_AZURE_FUNCTION_URL.replace(/\/api\/analyze$/, "");
  const url = new URL(`${base}${path}`);
  if (WXT_AZURE_FUNCTION_KEY) {
    url.searchParams.set("code", WXT_AZURE_FUNCTION_KEY);
  }
  return url.toString();
}

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await getIdToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  return headers;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw makeError("network-error", "Could not reach the saved-videos service.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Idempotent create-or-update; first call creates, later calls update (contracts/saved-videos-api.md). */
export async function saveVideo(videoId: string, input: SaveVideoInput): Promise<SavedVideoDetail> {
  const response = await request(`/api/saved-videos/${videoId}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await mapHttpError(response);
  }
  return (await response.json()) as SavedVideoDetail;
}

/** Returns null when nothing is saved for this videoId under the caller's account. */
export async function getSavedVideo(videoId: string): Promise<SavedVideoDetail | null> {
  const response = await request(`/api/saved-videos/${videoId}`, {
    method: "GET",
    headers: await authHeaders(),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await mapHttpError(response);
  }
  return (await response.json()) as SavedVideoDetail;
}

/** Lists the caller's saved videos (FR-012); an empty array is a normal, valid response (FR-017). */
export async function listSavedVideos(): Promise<SavedVideoSummary[]> {
  const response = await request("/api/saved-videos", {
    method: "GET",
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw await mapHttpError(response);
  }
  const body = (await response.json()) as { videos: SavedVideoSummary[] };
  return body.videos;
}

/** Unsaves a video (US3); idempotent — deleting an already-absent video is not an error. */
export async function deleteSavedVideo(videoId: string): Promise<void> {
  const response = await request(`/api/saved-videos/${videoId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw await mapHttpError(response);
  }
}

async function mapHttpError(response: Response): Promise<SavedVideoError> {
  const fallbackCode = codeForStatus(response.status);
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    const code = (body.error?.code as SavedVideoErrorCode | undefined) ?? fallbackCode;
    return makeError(code, body.error?.message ?? defaultMessage(fallbackCode));
  } catch {
    return makeError(fallbackCode, defaultMessage(fallbackCode));
  }
}

function codeForStatus(status: number): SavedVideoErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "not-authorized";
  if (status === 404) return "not-found";
  if (status === 409) return "saved-video-limit-reached";
  if (status >= 500) return "service-error";
  return "unknown";
}

function defaultMessage(code: SavedVideoErrorCode): string {
  switch (code) {
    case "unauthenticated":
      return "Sign in with Google to continue.";
    case "not-authorized":
      return "Access to this extension is invitation-only.";
    case "not-found":
      return "No saved video was found.";
    case "saved-video-limit-reached":
      return "You already have 200 saved videos — remove a saved video before saving another.";
    default:
      return "The saved-videos service encountered an error.";
  }
}

function makeError(code: SavedVideoErrorCode, message: string): SavedVideoError {
  return { code, message };
}
