# Implementation Plan: AI Chat Side Panel

**Branch**: `002-ai-chat-side-panel` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-ai-chat-side-panel/spec.md`

## Summary

Extend the existing WXT + React + TypeScript Chrome extension side panel with an interactive AI chat interface. Users can ask questions about the video transcript, request a generated blog post, and explore topics in depth. The side panel gains a two-tab layout (Summary / Chat). A new `POST /api/chat` Azure Function endpoint streams AI-generated replies as Server-Sent Events using the existing Azure OpenAI deployment. The chat client reads the transcript from an extended session cache (`Video` object stored alongside the existing `AnalysisResult`). Conversation history is persisted in `chrome.storage.session` keyed by video ID.

## Technical Context

**Language/Version**: TypeScript 5.x (extension and Azure Function — unchanged from feature 001)

**Primary Dependencies**:
- Extension (additions): `react-markdown` for rendering AI responses as formatted HTML
- Functions (unchanged): Azure Functions v4 Node.js 20 runtime, `@azure/openai` SDK, `@azure/functions` SDK; `enableHttpStreams: true` app setting required for SSE streaming

**Storage**: `chrome.storage.session` — two new key patterns:
- `video_${videoId}`: stores the full `Video` object (including transcript) after analysis completes
- `chat_${videoId}`: stores the `ChatSession` (conversation history), max 50 messages

**Testing**:
- Extension: Vitest (unit); Playwright (end-to-end streaming scenarios in Chrome)
- Azure Function: Vitest (unit); `msw` recorded fixtures for the new chat endpoint's streaming responses

**Target Platform**: Google Chrome 120+ (Manifest V3); Azure Functions Node.js 20 LTS (unchanged)

**Project Type**: browser-extension + cloud-function (same monorepo, same sub-project structure as feature 001)

**Performance Goals**:
- First streaming delta from `/api/chat` within 10 seconds (p95) for a 10-minute video
- Full chat response streamed within 15 seconds (p95)
- Blog post fully streamed within 60 seconds (p95, ~1,200 words)
- UI remains interactive (non-blocking) during streaming — no input lock

**Constraints**:
- Transcript truncated to 80,000 characters before being sent in chat requests; the chat client enforces this before the API call
- Conversation history capped at 50 messages per session to bound `chrome.storage.session` usage (Constitution QG-4 memory ceiling)
- Azure Function must have `enableHttpStreams: true` in host.json or app settings for SSE to work
- Same CORS and API key (`?code=`) requirements as `/api/analyze`
- MV3 Content Security Policy: no inline scripts; `react-markdown` must render safely within CSP constraints (it uses DOM parsing, not `eval`)
- `chrome.storage.session` quota: 10 MB shared across all session keys; transcript storage may be large for long videos but is bounded at 80 K chars (~80 KB per video)

**Scale/Scope**: Single-user extension (unchanged); one new Azure Function endpoint; same OpenAI deployment; session cache only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|-------------|--------|-------|
| QG-1 Code Quality | ESLint + Prettier zero warnings; no unlinked TODOs | ✅ Pass | New files follow existing ESLint config; chat components use same naming conventions as KnowledgePanel |
| QG-2 Test Coverage | ≥ 80% unit coverage on changed modules; integration tests use real fixtures | ✅ Pass | `chatOrchestrator.ts`, `chatClient.ts`, `chatCache.ts` must have unit coverage; streaming integration tested via `msw` recorded fixtures |
| QG-3 UX Consistency | Loading indicator ≤ 3 s; plain-language errors; consistent terminology | ✅ Pass | Streaming first delta ≤ 10 s (well within the 3 s indicator requirement — indicator appears immediately on submit); all error states use the existing `ErrorMessage` component pattern |
| QG-4 Performance | p95 ≤ 30 s for 10-min video; ≤ 512 MB RSS | ✅ Pass | Chat responses p95 ≤ 15 s; blog posts p95 ≤ 60 s; memory impact of chat history is bounded at ~80 KB/session |

**Post-Phase 1 re-check**: All gates still pass after design. History cap (50 messages) and transcript truncation (80 K chars) are the specific mechanisms that ensure QG-4 memory compliance. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-chat-side-panel/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── chat-api.md      # POST /api/chat SSE streaming contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
extension/                              # WXT browser extension
├── entrypoints/
│   └── sidepanel/
│       └── App.tsx                     # MODIFIED: add tab navigation (Summary / Chat)
├── components/
│   ├── Chat/
│   │   ├── ChatPanel.tsx               # NEW: top-level chat container; reads session; dispatches requests
│   │   ├── ChatMessageBubble.tsx       # NEW: renders a single message (user or assistant); markdown for assistant
│   │   ├── ChatInput.tsx               # NEW: textarea + submit button; enforces 2,000-char user input limit
│   │   └── BlogPostButton.tsx          # NEW: quick-action button that sends mode:'blog-post' request
│   ├── KnowledgePanel/
│   │   └── KnowledgePanel.tsx          # UNCHANGED
│   └── shared/
│       ├── TabBar.tsx                  # NEW: reusable two-tab navigation component (Summary / Chat)
│       ├── LoadingIndicator.tsx        # UNCHANGED
│       └── ErrorMessage.tsx           # UNCHANGED
├── services/
│   ├── chatClient.ts                   # NEW: calls POST /api/chat; reads SSE stream; yields delta chunks
│   ├── chatCache.ts                    # NEW: chrome.storage.session read/write for ChatSession (chat_${videoId})
│   ├── analysisClient.ts              # UNCHANGED
│   └── sessionCache.ts                # MODIFIED: add storeVideo(video) and getVideo(videoId) helpers
├── types/
│   ├── chat.ts                         # NEW: ChatMessage, ChatSession, ChatRequest interfaces
│   └── index.ts                       # UNCHANGED (existing Video, AnalysisResult, etc.)
└── tests/
    ├── unit/
    │   ├── chatClient.test.ts          # NEW
    │   ├── chatCache.test.ts           # NEW
    │   └── sessionCache.test.ts        # MODIFIED: add tests for new video storage helpers
    ├── integration/
    │   └── chat.integration.test.ts    # NEW: msw fixtures for streaming chat endpoint
    └── e2e/
        └── chat.e2e.test.ts            # NEW: Playwright test for full chat flow in Chrome

functions/                              # Azure Functions app
├── src/
│   ├── analyze/
│   │   └── index.ts                   # UNCHANGED
│   ├── chat/
│   │   └── index.ts                   # NEW: POST /api/chat HTTP trigger handler; streams SSE response
│   ├── models/
│   │   └── index.ts                   # MODIFIED: add ChatRequest, ChatHistoryItem, isChatRequest() type guard
│   └── services/
│       ├── chatOrchestrator.ts         # NEW: builds system prompt; calls Azure OpenAI streaming; yields delta chunks
│       ├── openaiOrchestrator.ts      # UNCHANGED
│       └── transcriptFetcher.ts       # UNCHANGED
├── tests/
│   ├── unit/
│   │   └── chatOrchestrator.test.ts   # NEW
│   └── integration/
│       └── chat.integration.test.ts   # NEW: msw recorded fixtures for Azure OpenAI streaming responses
└── host.json                          # MODIFIED: enableHttpStreams: true
```

**Structure Decision**: The feature fits entirely within the existing two-sub-project monorepo (`extension/` + `functions/`). New files are added alongside existing ones with consistent naming. The `Chat/` component directory mirrors the `KnowledgePanel/` structure. The `chat/` function directory mirrors the `analyze/` directory. No new sub-projects or shared packages are introduced.

## Complexity Tracking

> No constitution violations detected — this table is intentionally empty.
