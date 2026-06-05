interface CaptionTrack {
  baseUrl: string;
}

interface YtInitialPlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

function getYtInitialPlayerResponse(): YtInitialPlayerResponse | null {
  const w = globalThis as unknown as { ytInitialPlayerResponse?: YtInitialPlayerResponse };
  return w.ytInitialPlayerResponse ?? null;
}

export async function extractTranscript(): Promise<string | null> {
  const playerResponse = getYtInitialPlayerResponse();
  if (!playerResponse) return null;

  const tracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) return null;

  const baseUrl = tracks[0].baseUrl;
  const url = baseUrl.includes("?")
    ? `${baseUrl}&fmt=srv1`
    : `${baseUrl}?fmt=srv1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const xml = await response.text();
    return parseTimedText(xml);
  } catch {
    return null;
  }
}

function parseTimedText(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const textNodes = doc.querySelectorAll("text");
  const segments: string[] = [];

  textNodes.forEach((node) => {
    const text = node.textContent?.trim();
    if (text) segments.push(text);
  });

  return segments.join(" ");
}
