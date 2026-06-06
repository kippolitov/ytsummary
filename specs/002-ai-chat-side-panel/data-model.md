# Data Model: AI Chat Side Panel

**Feature**: 002-ai-chat-side-panel
**Date**: 2026-06-06

---

## Entities

### ChatMessage

A single turn in the conversation — either a user input or an AI-generated reply.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | Yes | UUID v4 generated client-side at message creation |
| `role` | `'user' \| 'assistant'` | Yes | Who authored the message |
| `content` | `string` | Yes | Full text content; may contain markdown for assistant messages |
| `type` | `'chat' \| 'blog-post'` | Yes | Distinguishes standard chat replies from blog post generations; controls rendering treatment |
| `timestamp` | `number` | Yes | Unix epoch milliseconds; used for ordering and display |

**Constraints**:
- `content` for user messages: 1–2,000 characters (enforced client-side before submission).
- `content` for assistant messages: no upper bound (streaming fills it progressively).
- A streaming assistant message is held in transient React state (not yet in session storage) until generation completes; only complete messages are persisted.

---

### ChatSession

The ordered collection of messages for a single video in the current browser session.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `videoId` | `string` | Yes | YouTube video ID (11-char alphanumeric); primary key for session storage lookup |
| `messages` | `ChatMessage[]` | Yes | Ordered array, oldest first |
| `createdAt` | `number` | Yes | Unix epoch ms of first message |
| `updatedAt` | `number` | Yes | Unix epoch ms of last message or update |

**Constraints**:
- Maximum 50 messages per session; when the 51st message would be added, the oldest user+assistant pair (2 messages) is dropped to make room.
- Stored in `chrome.storage.session` under the key `chat_${videoId}`.
- Cleared automatically by the browser when the session ends (tab/window closed).
- The side panel clears the session entry when the user navigates to a new video.

---

### StoredVideo (extension → session cache addition)

An addition to the existing session cache: the raw `Video` object is stored alongside `AnalysisResult` so the chat client can access the transcript without re-extracting it.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `videoId` | `string` | Yes | YouTube video ID |
| `title` | `string` | Yes | Video title |
| `channelName` | `string` | Yes | Channel name |
| `url` | `string` | Yes | Full YouTube URL |
| `durationSeconds` | `number` | Yes | Video duration |
| `transcript` | `string` | Yes | Full transcript text; may be truncated to 80 K characters before storage if larger |

**Storage key**: `video_${videoId}` in `chrome.storage.session`.

**Relation to existing types**: This is the existing `Video` interface from `extension/types/index.ts`, stored under a new key pattern. No new interface is needed — the existing type is reused.

---

## API Payload Shapes (extension ↔ Azure Function)

These shapes define what crosses the network boundary. Full contract details are in [contracts/chat-api.md](contracts/chat-api.md).

### ChatRequest (extension → Azure Function)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `videoId` | `string` | Yes | Video ID for logging/tracing |
| `videoTitle` | `string` | Yes | Included in system prompt for context |
| `transcript` | `string` | Yes | Full (or truncated) video transcript |
| `messages` | `ChatHistoryItem[]` | Yes | Conversation history to send to the model |
| `mode` | `'chat' \| 'blog-post'` | No | Defaults to `'chat'`; `'blog-post'` triggers blog post system prompt |

### ChatHistoryItem (subset of ChatMessage sent to the API)

| Field | Type | Notes |
|-------|------|-------|
| `role` | `'user' \| 'assistant'` | |
| `content` | `string` | Full text; streaming assistant messages are complete before being included |

### ChatStreamChunk (Azure Function → extension, per SSE event)

| Field | Type | Notes |
|-------|------|-------|
| `delta` | `string` | Text fragment to append to the current assistant message |

The final SSE line is the literal string `data: [DONE]` signalling stream completion.

---

## State Transitions

### ChatMessage lifecycle

```
[user submits input]
        ↓
  ChatMessage{role:'user'} created → appended to ChatSession.messages → persisted
        ↓
  ChatMessage{role:'assistant', content:''} created in React state (transient, streaming)
        ↓
  Stream chunks arrive → content appended in React state → UI updates progressively
        ↓
  [DONE] received → complete assistant message persisted to ChatSession in session storage
        ↓
  [ready for next turn]
```

### ChatSession lifecycle

```
[user opens chat tab on a video]
        ↓
  Load ChatSession from chrome.storage.session (key: chat_${videoId})
  → If not found: create empty ChatSession
        ↓
  [user sends messages] → session updated in storage after each assistant reply
        ↓
  [user navigates to a new video]
        ↓
  ChatSession for old video left in storage (still accessible if user returns)
  New empty ChatSession created for new video
        ↓
  [browser session ends] → chrome.storage.session cleared automatically
```
