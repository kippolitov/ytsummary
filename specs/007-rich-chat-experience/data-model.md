# Data Model: Rich Chat Experience

**Feature**: `007-rich-chat-experience` | **Date**: 2026-06-10

This document captures the entities and type extensions introduced or modified by this feature. All other types from feature 002 (`ChatMessage`, `ChatSession`, `ChatHistoryItem`) are reused unchanged.

---

## Modified Entities

### `ChatMessageType` (extension/types/chat.ts)

**Current**:
```
"chat" | "blog-post"
```

**Extended**:
```
"chat" | "blog-post" | "follow-up-prompts"
```

The `"follow-up-prompts"` value is used only in API requests to the backend; it is never stored as a `ChatMessage.type` value in a session. It signals the backend to return a JSON response rather than an SSE stream.

---

## New Entities

### `FollowUpPromptsRequest` (extension/types/chat.ts and functions/src/models/index.ts)

Extends `ChatRequest` with `mode: "follow-up-prompts"`. No additional fields required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `videoId` | `string` | yes | YouTube video identifier |
| `videoTitle` | `string` | yes | Video title for context |
| `transcript` | `string` | yes | Truncated transcript (same 80 k char limit) |
| `messages` | `ChatHistoryItem[]` | yes | Full conversation history including the latest assistant message |
| `mode` | `"follow-up-prompts"` | yes | Signals follow-up-prompts response mode |

**Validation rules** (backend):
- `messages` must contain at least two items (one user turn and one assistant turn) — the follow-up prompts are meaningless without a prior exchange
- All other validation rules from `ChatRequest` apply

### `FollowUpPromptsResponse` (extension/types/chat.ts)

The JSON body returned by the backend for `mode: "follow-up-prompts"`.

| Field | Type | Description |
|-------|------|-------------|
| `prompts` | `string[3]` | Exactly three follow-up prompt strings |

**Validation rules**:
- Array length must be exactly 3 (enforced by backend prompt engineering and response parsing)
- Each prompt must be a non-empty string
- Fallback: if parsing fails, the client receives an empty array and hides the chips silently

---

## Component Props (not persisted — UI contracts)

### `FollowUpPromptChipsProps` (extension/components/Chat/FollowUpPromptChips.tsx)

| Prop | Type | Description |
|------|------|-------------|
| `prompts` | `string[]` | The three prompt strings to display as chips |
| `onSelect` | `(prompt: string) => void` | Called when user clicks a chip; submits the prompt as next message |
| `isLoading` | `boolean` | When true, shows skeleton placeholder chips |

### `CalloutBlockProps` (extension/components/Chat/markdown/CalloutBlock.tsx)

| Prop | Type | Description |
|------|------|-------------|
| `children` | `React.ReactNode` | Parsed blockquote children from react-markdown |

Internal detection: inspects first child text node for a bold prefix matching `/^\*\*(Key Insight|Important|Tip|Warning|Note|Example)\*\*:/` pattern.

### `CodeBlockProps` (extension/components/Chat/markdown/CodeBlock.tsx)

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string \| undefined` | Language class injected by rehype-highlight (e.g., `language-typescript`) |
| `children` | `React.ReactNode` | Code content |

---

## State Shape (ChatPanel.tsx — React state, not persisted)

New state added to `ChatPanel`:

| State field | Type | Description |
|-------------|------|-------------|
| `followUpPrompts` | `string[]` | Current three follow-up prompts; empty array when hidden |
| `isLoadingFollowUp` | `boolean` | True while follow-up prompts are being fetched |

`followUpPrompts` is reset to `[]` whenever a new user message is submitted.

---

## Unchanged Entities

The following entities from feature 002 are **not modified** by this feature:

- `ChatMessage` — no new fields; follow-up prompts are ephemeral state
- `ChatSession` — unchanged; `chatCache.ts` is not modified
- `ChatHistoryItem` — unchanged
- `ChatStreamChunk` — unchanged
