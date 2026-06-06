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

  try {
    const response = await fetch(baseUrl);
    if (!response.ok) return null;

    const xml = await response.text();
    if (!xml || xml.length === 0) return null;

    return parseTimedText(xml);
  } catch {
    return null;
  }
}

function parseTimedText(xml: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const textNodes = doc.querySelectorAll("text");
  if (textNodes.length === 0) return null;

  const segments: string[] = [];
  textNodes.forEach((node) => {
    const text = node.textContent?.trim();
    if (text) segments.push(text);
  });

  const result = segments.join(" ").trim();
  return result.length > 0 ? result : null;
}
