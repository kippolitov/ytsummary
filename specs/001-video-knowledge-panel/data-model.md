# Data Model: Video Knowledge Panel

**Feature**: `001-video-knowledge-panel`
**Date**: 2026-06-05

---

## Overview

The data model covers two boundaries:

1. **Extension-side** — TypeScript interfaces in `extension/types/index.ts` used by the side
   panel, background service worker, content script, and session cache.
2. **Function-side** — TypeScript interfaces in `functions/src/models/index.ts` used by the
   Azure Function HTTP handler and OpenAI orchestrator.

The HTTP contract between extension and function is defined in
[contracts/analyze-api.md](contracts/analyze-api.md).

---

## Entities

### Video

Represents the YouTube video whose content is being analyzed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| videoId | string | ✅ | YouTube video ID (11-character alphanumeric) |
| title | string | ✅ | Video title extracted from `ytInitialPlayerResponse` |
| channelName | string | ✅ | Channel/creator name |
| url | string | ✅ | Full YouTube watch URL |
| durationSeconds | number | ✅ | Video duration in seconds |
| transcript | string | ✅ | Plain-text concatenation of all caption segments |

**Validation rules**:
- `videoId` MUST match `/^[a-zA-Z0-9_-]{11}$/`
- `transcript` MUST be non-empty before sending to analysis; empty string triggers
  `no-transcript` status
- `durationSeconds` MUST be > 0

---

### KnowledgePanelState

Represents the current UI state of the side panel for a given video. Lives in the side panel
React state and is persisted to `chrome.storage.session` on successful analysis.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| videoId | string | ✅ | Which video this state belongs to |
| status | PanelStatus | ✅ | Current lifecycle state (see state machine below) |
| result | AnalysisResult \| null | — | Populated when `status === 'ready'` |
| error | PanelError \| null | — | Populated when `status === 'error'` |
| analyzedAt | string \| null | — | ISO 8601 timestamp; populated when `status === 'ready'` |

**PanelStatus** (string union):

```
'idle' | 'loading' | 'ready' | 'error' | 'no-transcript'
```

**State transitions**:

```
idle ──(video page opens)──► loading
loading ──(analysis complete)──► ready
loading ──(API/network error)──► error
loading ──(no captions found)──► no-transcript
ready ──(user navigates to new video)──► loading
error ──(user retries)──► loading
no-transcript ──(user navigates to new video)──► loading
```

---

### AnalysisResult

The structured knowledge output returned by the Azure Function. Stored verbatim in
`chrome.storage.session` under key `videoId`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| videoId | string | ✅ | Echo of the requested video ID |
| summary | string | ✅ | 3–5 sentence plain-language overview |
| topics | Topic[] | ✅ | Major concepts; empty array if none identified |
| steps | ImplementationStep[] | ✅ | Ordered procedures; empty array if not a tutorial |
| references | Reference[] | ✅ | Named tools and resources; empty array if none |
| analyzedAt | string | ✅ | ISO 8601 timestamp of when analysis was produced |

---

### Topic

A major concept or subject area identified in the video.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | Concise topic name (e.g., "Dependency Injection") |
| description | string | ✅ | 1–2 sentence explanation of how the topic was covered |
| timestampSeconds | number \| null | — | Approximate timestamp in the video; null if not determinable |

**Validation**: `name` and `description` MUST be non-empty strings.

---

### ImplementationStep

A discrete, ordered action extracted from a procedural segment of the video.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| order | number | ✅ | 1-based sequential position |
| text | string | ✅ | Self-contained instruction text |
| timestampSeconds | number \| null | — | Approximate timestamp; null if not determinable |

**Validation**: `order` MUST be a positive integer; `text` MUST be non-empty.

---

### Reference

A named tool, library, product, paper, or website mentioned by the presenter.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✅ | The name as mentioned (e.g., "LangChain", "Attention Is All You Need") |
| description | string | ✅ | What it is and how the presenter used or described it |
| url | string \| null | — | URL if determinable from the transcript; null otherwise |
| context | string | ✅ | Direct quote or paraphrase of the presenter's mention |

**Validation**: `name`, `description`, and `context` MUST be non-empty strings.

---

### PanelError

Describes a failure state with user-facing messaging (Principle III compliance).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | ErrorCode | ✅ | Machine-readable error category |
| message | string | ✅ | Plain-language explanation for the user |
| action | string | ✅ | Suggested next action (e.g., "Try again", "Check captions are enabled") |
| retryable | boolean | ✅ | Whether a retry action should be shown |

**ErrorCode** (string union):

```
'network-error' | 'service-error' | 'rate-limited' | 'transcript-too-long' | 'unknown'
```

---

## Session Cache Schema

Stored in `chrome.storage.session`. Each entry is keyed by `videoId`.

```ts
// chrome.storage.session layout
{
  [videoId: string]: AnalysisResult
}
```

Entries are never explicitly evicted in v1; the browser clears all `chrome.storage.session`
data when the browser session ends.

---

## Extension ↔ Function Boundary

The content script and side panel communicate via `chrome.runtime.sendMessage`. The background
service worker owns the outbound HTTP call to the Azure Function.

**Message types** (extension-internal):

| Direction | Message type | Payload |
|-----------|-------------|---------|
| Content → Background | `TRANSCRIPT_READY` | `{ video: Video }` |
| Content → Background | `NO_TRANSCRIPT` | `{ videoId: string }` |
| Content → Side Panel | `VIDEO_CHANGED` | `{ videoId: string }` |
| Background → Side Panel | `ANALYSIS_RESULT` | `{ result: AnalysisResult }` |
| Background → Side Panel | `ANALYSIS_ERROR` | `{ error: PanelError }` |
| Side Panel → Background | `RETRY_ANALYSIS` | `{ videoId: string }` |
