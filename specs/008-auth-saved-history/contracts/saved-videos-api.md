# Contract: Saved Videos API

All routes require authentication (see `auth.md`). All routes are scoped to the caller's `sub` — no `userId`/`sub` is ever accepted from the request; it always comes from the verified token.

Base route: `/api/saved-videos`

## List saved videos

`GET /api/saved-videos`

**Response** `200`:

```json
{
  "videos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "videoTitle": "…",
      "channelName": "…",
      "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "durationSeconds": 212,
      "savedAt": "2026-07-01T12:00:00.000Z",
      "updatedAt": "2026-07-03T09:15:00.000Z"
    }
  ]
}
```

Note: list responses omit `summaryJson`/chat content (kept small for the Saved-view list UI, FR-012); full content is fetched via the "get one" route below when the user selects a video (FR-013). Empty `videos: []` is a normal, valid response (FR-017 empty state is a client-side concern, not an error).

## Get one saved video

`GET /api/saved-videos/{videoId}`

**Response** `200`:

```json
{
  "videoId": "dQw4w9WgXcQ",
  "videoTitle": "…",
  "channelName": "…",
  "videoUrl": "…",
  "durationSeconds": 212,
  "summary": { "videoId": "…", "tldr": ["…"], "topics": [], "steps": [], "references": [], "analyzedAt": "…" },
  "messages": [ { "id": "…", "role": "user", "content": "…", "type": "chat", "timestamp": 0 } ],
  "savedAt": "…",
  "updatedAt": "…"
}
```

`summary` uses the existing `AnalysisResult` shape; `messages` uses the existing `ChatMessage[]` shape — both unchanged from what the client already renders today (research.md §7).

**Response** `404` — no saved video for this `videoId` under this account (`{ "error": { "code": "not-found", "message": "…" } }`).

## Save or update a video

`PUT /api/saved-videos/{videoId}`

**Request**:

```json
{
  "videoTitle": "…",
  "channelName": "…",
  "videoUrl": "…",
  "durationSeconds": 212,
  "summary": { "...AnalysisResult shape..." },
  "messages": [ "...ChatMessage[] shape..." ]
}
```

Idempotent upsert: first call creates (`savedAt` set), subsequent calls update (`savedAt` preserved, `updatedAt` refreshed) — this is how "continue chatting after saving persists new messages" (FR-015) is implemented: the client re-PUTs with the full current message list after each new message on an already-saved video.

**Response** `200` on success (echoes the same shape as "get one"); `400` for malformed body (mirrors `isAnalyzeRequest`/`isChatRequest`-style validation already used elsewhere); `500`/`503` on storage failure, mapped client-side to the "save did not complete" state (FR-018) without partial local state changes.

## Delete (unsave) a video

`DELETE /api/saved-videos/{videoId}`

**Response** `204` on success (also `204` if it was already absent — delete is idempotent); no other success codes.

## Error envelope

All error responses use the existing `FunctionError` shape: `{ "error": { "code": string, "message": string } }`, extending today's `functions/src/models/index.ts` codes with `not-found` for this API's `404`s.
