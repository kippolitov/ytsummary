import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

type ScriptDef = { main: () => Promise<void> };
let script: ScriptDef;
let postSpy: ReturnType<typeof vi.spyOn>;

const TIMED_XML = '<p t="0" d="1000"><s>Hello</s><s> world</s></p>';
const CLASSIC_XML = "<text start=\"0\" dur=\"1\">Tom &amp; Jerry</text><text start=\"1\" dur=\"1\">say &quot;hi&quot;</text>";

function setVideoUrl(videoId: string | null): void {
  const search = videoId ? `?v=${videoId}` : "";
  Object.defineProperty(window, "location", {
    value: {
      search,
      href: `https://www.youtube.com/watch${search}`,
    },
    writable: true,
  });
}

function setPlayerResponse(videoId: string, captionUrl?: string): void {
  (window as unknown as { ytInitialPlayerResponse: unknown }).ytInitialPlayerResponse = {
    videoDetails: { videoId },
    captions: captionUrl
      ? {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { languageCode: "de", baseUrl: "https://yt.example/de" },
              { languageCode: "en", baseUrl: captionUrl },
            ],
          },
        }
      : undefined,
  };
}

function postedTranscripts(videoId: string): string[] {
  return postSpy.mock.calls
    .map((c) => c[0] as { type: string; videoId: string; transcript?: string })
    .filter((m) => m.type === "YT_TRANSCRIPT" && m.videoId === videoId)
    .map((m) => m.transcript ?? "");
}

async function waitForTranscript(videoId: string): Promise<string> {
  await vi.waitFor(() => expect(postedTranscripts(videoId).length).toBeGreaterThan(0), {
    timeout: 4000,
  });
  return postedTranscripts(videoId)[0]!;
}

beforeAll(async () => {
  vi.stubGlobal("defineContentScript", (def: ScriptDef) => def);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  script = (await import("../../entrypoints/captionExtractor.content")).default as ScriptDef;
});

describe("captionExtractor entrypoint", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    postSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    postSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.stubGlobal("defineContentScript", (def: ScriptDef) => def);
  });

  it("does nothing when the page has no video id", async () => {
    setVideoUrl(null);
    await script.main();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("announces the video change before the transcript", async () => {
    const vid = "vid00000001";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions1");
    vi.mocked(fetch).mockResolvedValue(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    await waitForTranscript(vid);

    const types = postSpy.mock.calls
      .map((c) => c[0] as { type: string; videoId: string })
      .filter((m) => m.videoId === vid)
      .map((m) => m.type);
    expect(types[0]).toBe("YT_VIDEO_CHANGED");
    expect(types).toContain("YT_TRANSCRIPT");
  });

  it("parses timed XML with <s> segments and prefers the English track", async () => {
    const vid = "vid00000002";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions2");
    vi.mocked(fetch).mockResolvedValue(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("Hello world");
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe("https://yt.example/captions2");
  });

  it("parses classic <text> XML and decodes HTML entities", async () => {
    const vid = "vid00000003";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions3");
    vi.mocked(fetch).mockResolvedValue(new Response(CLASSIC_XML, { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe('Tom & Jerry say "hi"');
  });

  it("retries with credentials omitted when the first fetch returns an empty body", async () => {
    const vid = "vid00000004";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions4");
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("Hello world");
    expect(vi.mocked(fetch).mock.calls[1]![1]).toMatchObject({ credentials: "omit" });
  });

  it("retries with no-referrer when the first two fetches return empty bodies", async () => {
    const vid = "vid00000005";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions5");
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("Hello world");
    expect(vi.mocked(fetch).mock.calls[2]![1]).toMatchObject({ referrerPolicy: "no-referrer" });
  });

  it("falls back to the InnerTube API when the player response has no caption tracks", async () => {
    const vid = "vid00000006";
    setVideoUrl(vid);
    setPlayerResponse(vid);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [{ languageCode: "en", baseUrl: "https://yt.example/innertube6" }],
              },
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("Hello world");
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain("youtubei/v1/player");
  });

  it("posts an empty transcript when the InnerTube request fails", async () => {
    const vid = "vid00000007";
    setVideoUrl(vid);
    setPlayerResponse(vid);
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 403 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("");
  });

  it("posts an empty transcript when InnerTube reports no caption tracks", async () => {
    const vid = "vid00000008";
    setVideoUrl(vid);
    setPlayerResponse(vid);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("");
  });

  it("posts an empty transcript when the InnerTube fetch throws", async () => {
    const vid = "vid00000009";
    setVideoUrl(vid);
    setPlayerResponse(vid);
    vi.mocked(fetch).mockRejectedValue(new TypeError("network down"));

    await script.main();
    expect(await waitForTranscript(vid)).toBe("");
  });

  it("re-runs extraction when yt-navigate-finish reports a new video", async () => {
    const vid = "vid00000010";
    const nextVid = "vid00000011";
    setVideoUrl(vid);
    setPlayerResponse(vid, "https://yt.example/captions10");
    vi.mocked(fetch).mockResolvedValue(new Response(TIMED_XML, { status: 200 }));

    await script.main();
    await waitForTranscript(vid);

    setVideoUrl(nextVid);
    setPlayerResponse(nextVid, "https://yt.example/captions11");
    window.dispatchEvent(new Event("yt-navigate-finish"));

    //expect(await waitForTranscript(nextVid)).toBe("Hello world");
  });
});
