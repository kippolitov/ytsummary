# Implementation Plan: Rich Chat Experience

**Branch**: `007-rich-chat-experience` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-rich-chat-experience/spec.md`

## Summary

Upgrade the Chat tab from basic markdown rendering to a full rich reading experience. The work spans three areas: (1) enhanced markdown rendering in the extension UI — adding GFM support (tables, strikethrough, task lists via `remark-gfm`), syntax-highlighted code blocks (`rehype-highlight`), and custom callout blocks with a visual border and label; (2) a system-prompt update to the Azure Function backend that instructs the AI to produce structured, well-formatted responses using headings, callouts, and tables; and (3) three dynamic follow-up prompt chips generated after each AI response via a separate lightweight backend call, clicking which submits the prompt as the user's next message.

## Technical Context

**Language/Version**: TypeScript 5.5 (extension + functions)

**Primary Dependencies**:
- Extension: React 18.3, react-markdown 9.1 (already installed), remark-gfm (new), rehype-highlight (new), highlight.js (new), Tailwind CSS 3.4, WXT (Vite-based extension builder)
- Functions: Azure Functions v4, Azure OpenAI SDK (`openai` package), Node 18

**Storage**: `chrome.storage.session` via IndexedDB wrapper (`chatCache.ts`) — session-scoped, carry over from feature 002

**Testing**: Vitest 1.6 + @testing-library/react 16 (unit), Playwright 1.44 (E2E)

**Target Platform**: Chrome extension (Manifest v3) side panel — desktop and mobile-width within ~380–420 px panel width

**Project Type**: Chrome extension (frontend React) + Azure Functions (Node backend)

**Performance Goals**: Follow-up prompts render within 2 seconds of main response completing (95th percentile); chat history renders within 500 ms of panel open

**Constraints**: Panel width ~380–420 px; no new UI framework; no new backend infrastructure; Azure OpenAI deployment unchanged (gpt-4o-mini); follow-up prompt fetch must not block or delay the main response stream

**Scale/Scope**: Single-user extension; no concurrent-load concern; existing SSE streaming architecture reused

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Check | Status |
|------|-------|--------|
| **QG-1 Code Quality** | No dead code; meaningful names; single responsibility; linter zero warnings | ✅ New components isolated under `components/Chat/markdown/`; no dead imports; follow-up logic extracted to `followUpClient.ts` |
| **QG-2 Test Coverage** | Unit tests ≥ 80% on changed modules; integration tests for external API interactions | ✅ `ChatMessageBubble`, `FollowUpPromptChips`, `followUpClient` require unit tests; follow-up prompts API path requires integration fixture |
| **QG-3 UX Review** | Loading indicators for > 300 ms ops; no silent frozen UI; plain-language errors | ✅ Main response streaming cursor already exists; follow-up prompts show a skeleton/loading state; silent failure on follow-up error per FR-012 |
| **QG-4 Performance** | p95 summary latency ≤ 30 s; memory ≤ 512 MB; no regression ≥ 20% | ✅ Follow-up prompt call is non-blocking and fires after stream completes; syntax highlighting library is loaded on demand |

**Post-design re-evaluation**: All gates satisfied by the design. No violations requiring exception documentation.

## Project Structure

### Documentation (this feature)

```text
specs/007-rich-chat-experience/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── follow-up-prompts-api.md
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
extension/
├── components/
│   └── Chat/
│       ├── ChatPanel.tsx                   (modified — replace hardcoded button with FollowUpPromptChips)
│       ├── ChatMessageBubble.tsx           (modified — wire in rich markdown renderer)
│       ├── FollowUpPromptChips.tsx         (new — 3 dynamic follow-up chips UI)
│       └── markdown/
│           ├── CalloutBlock.tsx            (new — visual callout/admonition renderer)
│           ├── CodeBlock.tsx               (new — syntax-highlighted code renderer)
│           └── markdownComponents.ts       (new — unified react-markdown component config)
├── services/
│   ├── chatClient.ts                       (unchanged)
│   └── followUpClient.ts                   (new — fetch follow-up prompts from backend)
└── types/
    └── chat.ts                             (modified — add FollowUpPromptsRequest/Response)

functions/
└── src/
    ├── chat/
    │   └── index.ts                        (modified — route follow-up-prompts mode to JSON response)
    ├── services/
    │   └── chatOrchestrator.ts             (modified — enriched system prompts + follow-up generator)
    └── models/
        └── index.ts                        (modified — extend ChatRequest mode union type)
```

**Structure Decision**: Extension components follow the existing flat-component pattern under `components/Chat/`. The `markdown/` subdirectory is introduced to encapsulate all rendering configuration (components, plugins) separately from panel and bubble logic. The backend extends the existing `/api/chat` endpoint with a new `mode` value rather than adding a new function, keeping infrastructure surface minimal.
