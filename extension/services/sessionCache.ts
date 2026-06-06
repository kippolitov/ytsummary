import type { AnalysisResult } from "../types/index";

const LAST_VIDEO_KEY = "__lastVideo__";

interface LastVideoMeta {
  videoId: string;
  title: string;
  channelName: string;
}

export async function getResult(videoId: string): Promise<AnalysisResult | null> {
  const data = await chrome.storage.session.get(videoId);
  const result = data[videoId] as AnalysisResult | undefined;
  return result ?? null;
}

export async function setResult(videoId: string, result: AnalysisResult): Promise<void> {
  await chrome.storage.session.set({ [videoId]: result });
}

export async function hasResult(videoId: string): Promise<boolean> {
  const result = await getResult(videoId);
  return result !== null;
}

export async function setLastVideo(meta: LastVideoMeta): Promise<void> {
  await chrome.storage.session.set({ [LAST_VIDEO_KEY]: meta });
}

export async function getLastVideo(): Promise<LastVideoMeta | null> {
  const data = await chrome.storage.session.get(LAST_VIDEO_KEY);
  return (data[LAST_VIDEO_KEY] as LastVideoMeta) ?? null;
}
