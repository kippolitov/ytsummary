export default defineContentScript({
  matches: ["*://www.youtube.com/watch*"],
  world: "MAIN",
  runAt: "document_idle",

  async main() {
    function getVideoId(): string | null {
      return new URLSearchParams(window.location.search).get("v");
    }

    // Try fetching captionURL directly with a few options, log what happens
    async function tryFetch(label: string, url: string, init?: RequestInit): Promise<string> {
      try {
        const resp = await fetch(url, init);
        const ct = resp.headers.get("content-type") ?? "?";
        const body = await resp.text();
        console.log(`[CaptionExtractor] ${label}: status=${resp.status} ct=${ct} bodyLen=${body.length} sample=${body.slice(0, 80)}`);
        return body;
      } catch (err) {
        console.error(`[CaptionExtractor] ${label} error:`, err);
        return "";
      }
    }

    async function extractTranscript(videoId: string): Promise<string> {
      // ── Attempt A: read from ytInitialPlayerResponse ──────────────────────
      let playerResponse: Record<string, unknown> | null = null;
      for (let i = 0; i < 20; i++) {
        const r = (window as unknown as { ytInitialPlayerResponse?: Record<string, unknown> })
          .ytInitialPlayerResponse;
        const vid = (r?.videoDetails as Record<string, unknown> | undefined)?.videoId;
        if (vid === videoId) { playerResponse = r ?? null; break; }
        await new Promise<void>((res) => setTimeout(res, 250));
      }

      const tracks = (
        playerResponse?.captions as
          | { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ languageCode: string; baseUrl: string }> } }
          | undefined
      )?.playerCaptionsTracklistRenderer?.captionTracks;

      console.log("[CaptionExtractor] tracks from ytIPR:", tracks?.length ?? 0);

      if (Array.isArray(tracks) && tracks.length > 0) {
        const track = tracks.find((t) => t.languageCode?.startsWith("en")) ?? tracks[0];
        console.log("[CaptionExtractor] selected track lang:", track.languageCode, "url (first 120):", track.baseUrl.slice(0, 120));

        // Try 1: default fetch
        const xml1 = await tryFetch("default", track.baseUrl);
        if (xml1.length > 0) return parseTranscriptXml(xml1);

        // Try 2: credentials omitted (no YouTube session cookies)
        const xml2 = await tryFetch("credentials:omit", track.baseUrl, { credentials: "omit" });
        if (xml2.length > 0) return parseTranscriptXml(xml2);

        // Try 3: no referer
        const xml3 = await tryFetch("no-referrer", track.baseUrl, { referrerPolicy: "no-referrer" });
        if (xml3.length > 0) return parseTranscriptXml(xml3);
      }

      // ── Attempt B: InnerTube ANDROID from browser ─────────────────────────
      console.log("[CaptionExtractor] falling back to InnerTube from browser");
      try {
        const itResp = await fetch(
          "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
              videoId,
            }),
          }
        );
        if (!itResp.ok) { console.warn("[CaptionExtractor] InnerTube status:", itResp.status); return ""; }
        const itData = await itResp.json();
        const itTracks = itData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        console.log("[CaptionExtractor] InnerTube tracks:", itTracks?.length ?? 0);
        if (!Array.isArray(itTracks) || itTracks.length === 0) return "";
        const itTrack = itTracks.find((t: { languageCode: string }) => t.languageCode?.startsWith("en")) ?? itTracks[0];
        console.log("[CaptionExtractor] InnerTube track url (120):", itTrack.baseUrl.slice(0, 120));
        const itXml = await tryFetch("InnerTube-xml", itTrack.baseUrl);
        return itXml.length > 0 ? parseTranscriptXml(itXml) : "";
      } catch (err) {
        console.error("[CaptionExtractor] InnerTube attempt failed:", err);
        return "";
      }
    }

    function decodeEntities(s: string): string {
      return s
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
    }

    function parseTranscriptXml(xml: string): string {
      const results: string[] = [];
      const pRe = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
      let m: RegExpExecArray | null;
      while ((m = pRe.exec(xml)) !== null) {
        const inner = m[3];
        const sRe = /<s[^>]*>([^<]*)<\/s>/g;
        let sm: RegExpExecArray | null;
        let text = "";
        while ((sm = sRe.exec(inner)) !== null) text += sm[1];
        if (!text) text = inner.replace(/<[^>]+>/g, "");
        text = decodeEntities(text).trim();
        if (text) results.push(text);
      }
      if (results.length > 0) return results.join(" ").replace(/\s+/g, " ").trim();
      const classicRe = /<text[^>]*>([^<]*)<\/text>/g;
      while ((m = classicRe.exec(xml)) !== null) {
        const text = decodeEntities(m[1]).trim();
        if (text) results.push(text);
      }
      return results.join(" ").replace(/\s+/g, " ").trim();
    }

    async function processVideo(videoId: string): Promise<void> {
      window.postMessage({ type: "YT_VIDEO_CHANGED", videoId }, "*");
      const transcript = await extractTranscript(videoId);
      console.log("[CaptionExtractor] final transcript length:", transcript.length);
      window.postMessage({ type: "YT_TRANSCRIPT", videoId, transcript }, "*");
    }

    // Extraction only starts once the side panel asks for it (relayed from
    // background via the isolated-world content script) — never on page load
    // on its own, so a video's transcript is never read in the background
    // without the user having opened the panel first.
    let armed = false;
    let lastVideoId: string | null = null;

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.type !== "YTKP_REQUEST_TRANSCRIPT") return;

      armed = true;
      const vid = getVideoId();
      if (!vid || vid === lastVideoId) return;
      lastVideoId = vid;
      void processVideo(vid);
    });

    window.addEventListener("yt-navigate-finish", () => {
      if (!armed) return;
      const vid = getVideoId();
      if (!vid || vid === lastVideoId) return;
      lastVideoId = vid;
      void processVideo(vid);
    });
  },
});
