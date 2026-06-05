import type { AnalysisResult } from "../types/index";

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
