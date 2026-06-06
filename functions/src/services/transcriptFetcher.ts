import { YoutubeTranscript } from "youtube-transcript";

export async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) return null;
    const text = segments.map((s) => s.text).join(" ").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
