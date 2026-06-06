# Research: AI Chat Side Panel

**Feature**: 002-ai-chat-side-panel
**Date**: 2026-06-06
**Status**: Complete — all unknowns resolved

---

## Decision 1: Chat API endpoint design

**Decision**: Add a dedicated `POST /api/chat` HTTP trigger to the Azure Functions app, separate from the existing `POST /api/analyze` endpoint.

**Rationale**: The analyze endpoint performs a single-shot structured extraction returning typed JSON fields (summary, topics, steps, references). The chat endpoint requires a different input shape (conversation history, mode flag) and returns a streaming text delta instead of structured JSON. Mixing these into one function handler would couple two unrelated contracts and complicate independent optimization and testing. A separate function keeps each handler small and single-purpose, consistent with the existing project's single-responsibility principle (Constitution QG-1).

**Alternatives considered**:
- _Extending `/api/analyze` with a `mode` parameter_: Rejected because it conflates two distinct interaction models (one-shot structured extraction vs. multi-turn free-form chat) in one handler, making the function harder to reason about, test, and evolve.
- _Adding a query parameter to select behavior_: Same problem as above — single entry point, branching internal logic, complex contract.

---

## Decision 2: Streaming response strategy

**Decision**: Use Server-Sent Events (SSE) streaming from the Azure Function to the side panel. The function streams text delta chunks as `data: {"delta":"..."}` lines terminated by `data: [DONE]`. The side panel reads the stream directly via the Fetch API's `ReadableStream` interface.

**Rationale**: Streaming dramatically improves perceived performance for long responses such as blog posts (600–1,200 words). Users see text appearing progressively rather than facing a blank screen for several seconds. Azure Functions v4 Node.js supports streaming HTTP responses via `enableHttpStreams` and a `ReadableStream` or `AsyncIterable` response body. The extension side panel is a regular web page (not a service worker) and can consume streaming fetch responses natively.

**Alternatives considered**:
- _Non-streaming (wait for full response)_: Simpler to implement but creates a poor user experience for long-form generation (blog posts may take 5–15 seconds with no feedback). Violates Constitution QG-3 (feedback contract for operations > 300 ms).
- _WebSocket connection_: Bidirectional and more complex to set up; unnecessary overhead for a strictly server-→-client data flow.

---

## Decision 3: Transcript availability for chat

**Decision**: Extend the existing session cache to also store the raw `Video` object (including the transcript string) alongside the `AnalysisResult`. The chat client in the side panel reads the cached `Video.transcript` to include in each chat request.

**Rationale**: The existing `AnalysisResult` (stored by `sessionCache.ts`) does not include the raw transcript — it only stores processed output. The chat AI needs the full transcript as context for every conversation turn. Storing the `Video` object in session cache is the cleanest approach: it reuses the existing `chrome.storage.session` infrastructure, keeps the chat client stateless, and avoids requiring re-extraction of the transcript when the user opens the chat tab.

**Alternatives considered**:
- _Re-request transcript from the content script on demand_: Requires additional message passing between the side panel, background service worker, and content script; adds latency; the content script may not be active if the user hasn't interacted with the page.
- _Store only the transcript string separately_: Works but adds an extra storage key without providing more value than storing the full `Video` object, which may be useful for other future features (e.g., showing video title in the chat header).

---

## Decision 4: Conversation history storage

**Decision**: Store `ChatSession` (ordered array of `ChatMessage` objects) in `chrome.storage.session` keyed as `chat_${videoId}`. Limit history to 50 messages per session to bound memory consumption.

**Rationale**: Session-scoped storage is consistent with the existing caching strategy for analysis results. Chat history is naturally session-scoped — it is only meaningful while the user is watching the video in the current browser session. A 50-message cap prevents unbounded growth in long sessions while comfortably covering realistic usage (a typical Q&A session involves far fewer turns). No additional infrastructure is required.

**Alternatives considered**:
- _React component state only_: Simpler but history is lost when the side panel is closed and reopened, violating FR-003 (conversation history must persist across panel open/close within a session).
- _IndexedDB for persistent cross-session history_: Heavier infrastructure; cross-session persistence is explicitly out of scope per the spec assumptions.

---

## Decision 5: Side panel layout — tab navigation

**Decision**: Extend the side panel UI with a two-tab layout: a "Summary" tab (existing `KnowledgePanel`) and a "Chat" tab (new `ChatPanel`). Both tabs are always accessible.

**Rationale**: The side panel has limited vertical space. Displaying the knowledge panel summary and a full chat interface simultaneously would require aggressive vertical compression or scrolling that harms usability. A tab navigation model is a standard pattern for this constraint, keeps each view focused, and does not require replacing or hiding the existing panel.

**Alternatives considered**:
- _Chat always visible below the knowledge panel_: Works on tall screens but would make the chat unusable on typical laptop displays without excessive scrolling.
- _Replace the knowledge panel with the chat_: Loses the one-shot summary view that is the primary feature of the extension.

---

## Decision 6: Markdown rendering

**Decision**: Add `react-markdown` to the extension's dependencies to render AI-generated content (chat responses and blog posts) as formatted HTML within the side panel.

**Rationale**: Blog posts benefit from headers, bullet points, and bold text. Raw markdown text would be readable but noticeably unpolished, especially compared to the structured design of the existing knowledge panel sections. `react-markdown` is a mature, lightweight library with no runtime dependencies beyond React.

**Alternatives considered**:
- _Plain text_: Simpler but blog posts require headings and paragraphs; plain text output degrades the feature's perceived quality.
- _Custom markdown parser_: Unnecessary complexity when a well-maintained library exists.

---

## Decision 7: Blog post generation mechanism

**Decision**: Implement "Generate Blog Post" as a quick-action button in the chat UI that sends a predefined system-level prompt (`mode: 'blog-post'`) through the same `/api/chat` endpoint. No separate endpoint or API contract is needed.

**Rationale**: The blog post is just a specialized prompt to the same underlying chat model. Routing it through the chat endpoint keeps the backend API minimal and allows the AI's structured output (title, intro, sections, conclusion) to be enforced via prompt engineering rather than a separate schema. The side panel marks blog-post messages with a distinct visual treatment and a copy button.

**Alternatives considered**:
- _Dedicated `/api/blog-post` endpoint_: Adds an endpoint for functionality already expressible via the chat endpoint's `mode` parameter; unnecessary complexity.

---

## Resolved Clarifications

All specification areas had clear defaults or were resolvable from the existing codebase context. No `[NEEDS CLARIFICATION]` markers were present in the spec. Key resolutions:

| Area | Resolution |
|------|-----------|
| Transcript source for chat | Read cached `Video` object from `chrome.storage.session` |
| Context window overflow | Truncate transcript to 80 K characters (covers ~90-minute videos); warn user |
| History persistence | `chrome.storage.session` keyed by `chat_${videoId}`, max 50 messages |
| Streaming | SSE via Azure Functions v4 `enableHttpStreams` + Fetch `ReadableStream` |
| UI layout | Two-tab side panel (Summary / Chat) |
| Markdown | `react-markdown` package |
| Blog post | Quick-action button sending `mode: 'blog-post'` to `/api/chat` |
