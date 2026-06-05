# Research: Video Knowledge Panel

**Phase**: 0 — Pre-design research
**Feature**: `001-video-knowledge-panel`
**Date**: 2026-06-05

---

## 1. WXT Side Panel (Chrome MV3)

**Decision**: Use WXT `entrypoints/sidepanel/` convention to register a Manifest V3 side panel.

**Rationale**: WXT auto-generates the MV3 manifest `side_panel` key and wires the `sidePanel.open`
permission. A `background.ts` service worker listens for the `chrome.action.onClicked` event and
calls `chrome.sidePanel.open({ windowId })`. The side panel entry is a standard React/Vite app —
hot module replacement works in development via `wxt dev`.

**How to configure**:
```ts
// wxt.config.ts
export default defineConfig({
  manifest: {
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
    side_panel: { default_path: 'sidepanel/index.html' },
  },
});
```

**Alternatives considered**:
- Plasmo framework — similar feature set but less actively maintained; WXT preferred.
- Vanilla MV3 without framework — excessive boilerplate for a React app.

---

## 2. YouTube Transcript Extraction

**Decision**: Content script reads `ytInitialPlayerResponse` from the page, extracts the first
available caption track URL (auto-generated or manual), fetches the timedtext XML at that URL
(same-origin, so session cookies are included automatically), and parses the XML into a
plain-text string.

**Rationale**: YouTube embeds the full player configuration — including caption track manifest
URLs — in a `<script>` tag as `ytInitialPlayerResponse`. This object is accessible in the page's
window context. The timedtext XML endpoint requires no OAuth; it uses the user's existing YouTube
session. The content script runs in the page's origin context, so the browser attaches session
cookies automatically.

**Extraction steps (content script)**:
1. Wait for `ytInitialPlayerResponse` to be set on `window` (poll or `MutationObserver` on
   `#movie_player`).
2. Read `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[0]`
   to get the `baseUrl` of the first available track.
3. `fetch(baseUrl + '&fmt=srv1')` returns timedtext XML.
4. Parse XML: concatenate all `<s>` element text nodes, normalising whitespace.
5. Extract `videoDetails.videoId`, `videoDetails.title`, `videoDetails.channelName`,
   `videoDetails.lengthSeconds` from the same `ytInitialPlayerResponse`.

**No-transcript fallback**: If `captionTracks` is absent or empty, content script sends a
`{ status: 'no-transcript' }` message to the side panel — panel renders the plain-language
explanation required by FR-010.

**Navigation handling**: YouTube is a SPA. Content script listens for `yt-navigate-finish`
custom DOM event to detect video changes and re-trigger extraction.

**Alternatives considered**:
- YouTube Data API v3 captions endpoint — requires OAuth; impractical for an extension that
  should activate without authentication setup.
- Third-party transcript services — introduces external dependency and latency; avoided.

---

## 3. Azure OpenAI Prompt Structure

**Decision**: Single synchronous call to Azure OpenAI `gpt-4o-mini` deployment using
`response_format: { type: "json_object" }` (JSON mode). System prompt defines the exact output
schema; user message contains the transcript.

**Model choice**: `gpt-4o-mini` — sufficient reasoning capability for extraction tasks;
~10–20× cheaper than `gpt-4o`; 128k context handles transcripts up to ~90 minutes comfortably.

**System prompt outline**:
```
You are a technical content analyst. Given a YouTube video transcript, extract the following
and return ONLY valid JSON matching this schema:
{
  "summary": "3-5 sentence plain-language overview",
  "topics": [{ "name": "...", "description": "...", "timestampSeconds": null }],
  "steps": [{ "order": 1, "text": "...", "timestampSeconds": null }],
  "references": [{ "name": "...", "description": "...", "url": null, "context": "..." }]
}
Rules:
- summary: what the video teaches, not a plot summary
- topics: major concepts only (5-10); omit minor mentions
- steps: ordered implementation actions; omit if video has no procedural content
- references: named tools, libraries, papers, websites; omit if none mentioned
- timestampSeconds: populate if the transcript includes time codes; otherwise null
```

**Token budget** (10-min video): ~2,500 words transcript ≈ 3,300 input tokens + ~800 system
prompt tokens = ~4,100 total input; response ≈ 600 tokens. Well within `gpt-4o-mini` 128k
limit. Expected latency: 4–8 s.

**Alternatives considered**:
- Streaming response — reduces perceived latency but complicates the Azure Function → extension
  message passing; deferred to future enhancement.
- Multiple calls (one per section) — higher cost and latency; single structured call preferred.
- `gpt-4o` — 10× higher cost for marginal quality gain on extraction tasks; not chosen.

---

## 4. Azure Function: CORS + Authentication

**Decision**: Function-level API key passed as `x-functions-key` header; CORS origin allowlist
configured to include the extension's `chrome-extension://<extensionId>` origin.

**Rationale**: Function-level keys are the simplest auth mechanism for a single-consumer
API in v1. The extension embeds the function URL and key as build-time environment variables
(`WXT_AZURE_FUNCTION_URL`, `WXT_AZURE_FUNCTION_KEY`), injected via Vite's `define`. This
means the key is not user-visible but is present in the extension bundle — acceptable for
v1 single-user use; upgrade to Azure AD managed identity for multi-user scenarios.

**CORS**: Azure Functions does not automatically allow `chrome-extension://` origins. The
`host.json` CORS section must explicitly list the extension's origin. In development, wildcard
`*` is used; in production the exact `chrome-extension://<id>` origin is listed.

**Request shape**: `POST /api/analyze` with JSON body (see `contracts/analyze-api.md`).

**Error handling**: Function returns structured JSON error responses for 400, 422, 429, 500.
The extension's `analysisClient.ts` maps each status code to a user-facing error message per
Principle III.

**Alternatives considered**:
- Azure AD authentication — more secure but requires user sign-in, adding friction; deferred.
- Direct call from extension to Azure OpenAI — exposes OpenAI API key in extension bundle;
  unacceptable security posture.

---

## 5. Session Cache (`chrome.storage.session`)

**Decision**: Use `chrome.storage.session` as the session-scoped key-value store, keyed by
`videoId`.

**Rationale**: `chrome.storage.session` is available in MV3 service workers, side panel pages,
and content scripts. It persists across panel open/close within a session and is automatically
cleared when the browser closes — matching FR-014 exactly. Max storage is 10 MB per extension,
which comfortably holds hundreds of text-based analysis results.

**Cache flow**:
1. Side panel requests analysis for `videoId`.
2. `sessionCache.ts` checks `chrome.storage.session.get(videoId)`.
3. Cache hit → return cached result immediately (< 50 ms).
4. Cache miss → call Azure Function, store result, return.

**Eviction**: No explicit eviction needed in v1; browser clears on session end. If storage
quota is approached, LRU eviction can be added in a future iteration.

**Alternatives considered**:
- `sessionStorage` (Web Storage API) — not accessible from service worker; not suitable.
- `chrome.storage.local` — persists across sessions; contradicts FR-014; not chosen.
- In-memory Map in service worker — cleared when service worker is suspended (MV3 workers
  suspend after ~30 s of inactivity); unreliable for caching.
