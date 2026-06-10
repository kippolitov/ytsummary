# Contract: Follow-Up Prompts API

**Feature**: `007-rich-chat-experience` | **Date**: 2026-06-10

This document defines the contract for the follow-up prompts mode added to the existing `/api/chat` Azure Function endpoint.

---

## Endpoint

**Reuses**: `POST /api/chat` (existing endpoint from feature 002)

**Base URL**: `WXT_AZURE_FUNCTION_URL/api/chat`

**Authentication**: `?code={WXT_AZURE_FUNCTION_KEY}` query parameter (existing pattern)

---

## Request

**Content-Type**: `application/json`

```json
{
  "videoId": "dQw4w9WgXcQ",
  "videoTitle": "Never Gonna Give You Up",
  "transcript": "<transcript text truncated to 80,000 chars>",
  "messages": [
    { "role": "user",      "content": "What is the main theme of this video?" },
    { "role": "assistant", "content": "The main theme is unconditional love and commitment..." }
  ],
  "mode": "follow-up-prompts"
}
```

**Field constraints** (all inherited from existing `ChatRequest`, plus):

| Field | Constraint |
|-------|-----------|
| `mode` | Must be `"follow-up-prompts"` for this contract |
| `messages` | Must contain ≥ 2 items (at least one user + one assistant turn) |
| `transcript` | Max 80,000 characters (truncated client-side before sending) |

---

## Response (success)

**Status**: `200 OK`

**Content-Type**: `application/json` *(not SSE — this mode returns a complete JSON body)*

```json
{
  "prompts": [
    "What evidence did the speaker give to support this claim?",
    "How does this compare to what other creators say about the same topic?",
    "What action can I take based on what was discussed in this video?"
  ]
}
```

**Guarantees**:
- `prompts` array always contains exactly 3 strings
- Each string is a non-empty, complete English sentence ending with `?`
- No prompt is a duplicate of another in the same response
- Response is returned as a complete JSON body (no streaming)

---

## Response (errors)

Errors follow the same format as the existing `/api/chat` error responses.

| HTTP Status | Scenario | Client behaviour |
|-------------|----------|-----------------|
| `400` | Missing required fields or `messages.length < 2` | Hide follow-up chips silently |
| `429` | Rate limited | Hide follow-up chips silently |
| `500` | Backend error | Hide follow-up chips silently |

All follow-up-prompt errors are handled silently on the client per spec FR-012 — the main response is always shown regardless.

---

## Backend Behaviour

When the backend receives `mode: "follow-up-prompts"`:

1. Build a condensed context from `videoTitle` and the last assistant message (not full transcript — reduces tokens)
2. Call Azure OpenAI with a dedicated follow-up system prompt instructing it to return exactly 3 follow-up question strings as a JSON array
3. Parse the JSON from the model response
4. Return `{ "prompts": [...] }` as a `200 application/json` response

**System prompt (follow-up mode)**:
```
You generate follow-up questions for a YouTube video conversation assistant.
Given the conversation history below, produce exactly 3 follow-up questions
that would help the user explore deeper insights, challenge assumptions,
discover related topics, or take meaningful next steps based on what was discussed.

Rules:
- Return ONLY a valid JSON array of 3 strings: ["Q1", "Q2", "Q3"]
- Each question must end with "?"
- Questions must be specific to this conversation — not generic
- No duplicates
```

---

## Client Integration

The client (`followUpClient.ts`) calls this endpoint after the main response stream completes:

```
POST /api/chat?code=...
Body: { videoId, videoTitle, transcript, messages (including latest assistant reply), mode: "follow-up-prompts" }

On 200: parse JSON, extract prompts array, pass to FollowUpPromptChips
On error: resolve with [] (silent failure)
Timeout: 10 seconds (shorter than the 65s main chat timeout)
```

The call is non-blocking with respect to the UI — the main response is fully rendered before this request fires.

---

## Backward Compatibility

This contract extends the existing `/api/chat` endpoint by adding a new `mode` value. Existing `mode: "chat"` and `mode: "blog-post"` behaviour is unchanged.
