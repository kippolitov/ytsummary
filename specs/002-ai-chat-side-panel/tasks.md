# Tasks: AI Chat Side Panel

**Input**: Design documents from `specs/002-ai-chat-side-panel/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/chat-api.md ✅ | quickstart.md ✅

**Tests**: Included — the project constitution mandates test-first (Red-Green-Refactor) with ≥ 80% unit coverage on changed modules and integration tests via recorded fixtures.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and enable required runtime features before any implementation begins.

- [x] T001 Add `"enableHttpStreams": true` to `functions/host.json` under the `extensions.http` key to enable SSE streaming responses from Azure Functions v4
- [x] T002 Add `react-markdown` and its peer `@types/react-markdown` (if separate) to `extension/package.json` dependencies; run `npm install` in `extension/`
- [x] T003 [P] Verify `react-markdown` renders safely under Chrome MV3 Content Security Policy by confirming it uses DOM parsing (not `eval`); add a CSP test note to `extension/tests/unit/` if any adjustment is needed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, storage helpers, and background-script wiring that ALL user story phases depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `extension/types/chat.ts` defining `ChatMessage`, `ChatSession`, and `ChatRequest` interfaces per `data-model.md`; export from `extension/types/index.ts`
- [x] T005 [P] Extend `functions/src/models/index.ts` with `ChatRequest`, `ChatHistoryItem`, and `ChatResponse` interfaces plus an `isChatRequest()` type guard as specified in `contracts/chat-api.md`
- [x] T006 Extend `extension/services/sessionCache.ts` with `storeVideo(video: Video): Promise<void>` (key: `video_${videoId}`) and `getVideo(videoId: string): Promise<Video | null>` helpers for caching the raw transcript alongside analysis results
- [x] T007 Update `extension/entrypoints/background.ts` to call `storeVideo(video)` immediately after a successful analysis result is received, ensuring the transcript is cached before the side panel renders

**Checkpoint**: Foundation ready — session cache extended, types defined, streaming enabled. User story phases can now begin.

---

## Phase 3: User Story 1 — Ask Questions About the Video (Priority: P1) 🎯 MVP

**Goal**: Users can open the Chat tab in the side panel, type a question about the video, and receive a streamed AI-generated answer grounded in the transcript, with full conversation context carried across turns.

**Independent Test**: Open the side panel on any YouTube video where the knowledge panel has loaded. Click the "Chat" tab. Ask a factual question. Verify a streamed, accurate answer appears within 15 seconds. Close and reopen the panel — verify history is intact.

### Tests for User Story 1 ⚠️ Write these FIRST — confirm they FAIL before implementation

- [x] T008 [P] [US1] Write unit tests for `extension/services/chatCache.ts` in `extension/tests/unit/chatCache.test.ts` — cover `getChatSession`, `saveChatSession`, `clearChatSession`, and the 50-message cap behaviour; confirm tests fail (file does not exist yet)
- [x] T009 [P] [US1] Write unit tests for `extension/services/chatClient.ts` in `extension/tests/unit/chatClient.test.ts` — cover SSE delta parsing, stream completion on `[DONE]`, network error propagation, and transcript truncation at 80 K chars; confirm tests fail
- [x] T010 [P] [US1] Write unit tests for `functions/src/services/chatOrchestrator.ts` (chat mode) in `functions/tests/unit/chatOrchestrator.test.ts` — cover system prompt construction with transcript and history, delta emission, and error propagation; confirm tests fail
- [x] T011 [P] [US1] Write integration tests for `POST /api/chat` (chat mode) in `functions/tests/integration/chat.integration.test.ts` using `msw` recorded fixtures for the Azure OpenAI streaming response; confirm tests fail
- [x] T012 [P] [US1] Write unit tests for the new `storeVideo` / `getVideo` helpers from T006 in `extension/tests/unit/sessionCache.test.ts` (extend existing file); confirm tests fail

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement `extension/services/chatCache.ts` — `getChatSession(videoId)`, `saveChatSession(session)`, `clearChatSession(videoId)`; enforce 50-message cap by dropping oldest user+assistant pair when limit is exceeded; make T008 pass
- [x] T014 [US1] Implement `functions/src/services/chatOrchestrator.ts` — build the `mode:'chat'` system prompt (video title + truncated transcript) and conversation history, call Azure OpenAI with streaming enabled, and yield `{delta: string}` chunks followed by `[DONE]`; make T010 pass
- [x] T015 [US1] Implement `functions/src/chat/index.ts` — `POST /api/chat` HTTP trigger: validate request body with `isChatRequest()`, call `chatOrchestrator`, write SSE chunks to the response stream (`Content-Type: text/event-stream`), handle errors with appropriate HTTP status codes per `contracts/chat-api.md`; make T011 pass
- [x] T016 [US1] Implement `extension/services/chatClient.ts` — `sendChatMessage(request: ChatRequest): AsyncGenerator<string>` — POST to `/api/chat?code=...`, read the `ReadableStream`, parse SSE lines, yield delta strings, throw typed `PanelError` on HTTP or network failure; enforce 80 K transcript truncation before sending; make T009 pass
- [x] T017 [P] [US1] Create `extension/components/Chat/ChatInput.tsx` — controlled `<textarea>` with a Send button; enforces 2,000-character user input limit with character counter; calls `onSubmit(text)` prop; shows disabled state while AI is responding; includes `aria-label` attributes
- [x] T018 [P] [US1] Create `extension/components/Chat/ChatMessageBubble.tsx` — renders a single `ChatMessage`; user messages in a plain styled bubble; assistant messages rendered via `react-markdown`; visually distinct by role; includes `aria-label` for accessibility
- [x] T019 [US1] Create `extension/components/Chat/ChatPanel.tsx` — loads `ChatSession` from `chatCache` on mount (keyed to current video ID from `sessionCache`); dispatches `chatClient.sendChatMessage`; streams deltas into a transient assistant message in React state; persists completed messages via `chatCache`; shows `LoadingIndicator` while streaming; shows `ErrorMessage` on failure; renders message list via `ChatMessageBubble`; renders `ChatInput` at bottom; shows no-transcript notice (disabled input) when `getVideo()` returns null
- [x] T020 [P] [US1] Create `extension/components/shared/TabBar.tsx` — reusable two-tab component accepting `tabs: {id, label}[]` and `activeTab` / `onTabChange` props; keyboard-navigable; includes `aria-label` and `role="tablist"` semantics
- [x] T021 [US1] Update `extension/entrypoints/sidepanel/App.tsx` to render `TabBar` with "Summary" and "Chat" tabs above the existing `KnowledgePanel`; conditionally render `KnowledgePanel` or `ChatPanel` based on active tab; preserve existing knowledge panel behaviour

**Checkpoint**: User Story 1 is fully functional. Chat tab works end-to-end, conversation history persists across panel open/close, no-transcript state is handled. Validate against `quickstart.md` Scenarios 1–3, 6, 7 before proceeding.

---

## Phase 4: User Story 2 — Generate a Blog Post (Priority: P2)

**Goal**: Users can click "Generate Blog Post" in the chat panel and receive a structured, formatted blog post (title, introduction, sections, conclusion) streamed into the chat, with a copy-to-clipboard button.

**Independent Test**: Click the "Generate Blog Post" button on a video with a cached transcript. Verify a complete, markdown-formatted blog post streams into the chat within 60 seconds, containing all required structural elements. Click "Copy" — verify clipboard contents are correct and confirmation appears within 1 second.

### Tests for User Story 2 ⚠️ Write these FIRST — confirm they FAIL before implementation

- [x] T022 [P] [US2] Extend `functions/tests/unit/chatOrchestrator.test.ts` with test cases for `mode:'blog-post'` — verify the blog-post system prompt is used (not the Q&A prompt), and that conversation history is excluded; confirm new test cases fail
- [x] T023 [P] [US2] Add blog-post fixture to `functions/tests/integration/chat.integration.test.ts` using `msw` for a recorded Azure OpenAI streaming response returning a full blog post; confirm test fails

### Implementation for User Story 2

- [x] T024 [US2] Update `functions/src/services/chatOrchestrator.ts` to handle `mode:'blog-post'` — use the blog-post system prompt from `contracts/chat-api.md` (title, intro, 2–5 sections, conclusion, 600–1,200 words, markdown); ignore conversation history for this mode; make T022 pass
- [x] T025 [P] [US2] Create `extension/components/Chat/BlogPostButton.tsx` — a styled button labelled "Generate Blog Post"; calls `onGenerate()` prop when clicked; disabled while AI is responding; includes `aria-label`
- [x] T026 [US2] Update `extension/components/Chat/ChatPanel.tsx` to render `BlogPostButton` above the `ChatInput`, passing `mode:'blog-post'` to `chatClient.sendChatMessage` when clicked; marks the resulting assistant message with `type:'blog-post'`
- [x] T027 [US2] Update `extension/components/Chat/ChatMessageBubble.tsx` to show a "Copy" button on messages where `type === 'blog-post'`; clicking copies the raw markdown content to the clipboard via the Clipboard API; shows a brief "Copied!" confirmation within 1 second; includes `aria-label="Copy blog post"`

**Checkpoint**: User Stories 1 AND 2 are both fully functional and independently testable. Validate against `quickstart.md` Scenario 4 before proceeding.

---

## Phase 5: User Story 3 — Deep Dive Into a Topic (Priority: P3)

**Goal**: Users can ask the AI to elaborate on any topic mentioned in the video and receive a response that goes beyond quoting the transcript — supplementing with contextual explanation, clearly distinguishing video-sourced content from supplementary context.

**Independent Test**: Ask the AI "Explain [specific topic from the video] in more depth". Verify the response extends beyond a direct quote, provides additional context, and (where the topic was brief in the video) acknowledges how much the video covered before supplementing.

### Implementation for User Story 3

- [x] T028 [US3] Update the `mode:'chat'` system prompt in `functions/src/services/chatOrchestrator.ts` to explicitly instruct the model to elaborate beyond the transcript when asked: supplement with relevant general knowledge, always distinguishing "In the video, ..." from "More broadly, ..." in its responses; run `functions/tests/unit/chatOrchestrator.test.ts` to confirm no regressions
- [x] T029 [P] [US3] Add a "Dive Deeper" quick-action suggestion chip to `extension/components/Chat/ChatPanel.tsx` that appears below the most recent assistant message; clicking pre-fills the chat input with "Can you dive deeper into [last topic]?" to lower friction for follow-up exploration

**Checkpoint**: All three user stories are independently functional. Validate against `quickstart.md` Scenario 2 (follow-up questions / deep dive) before Polish phase.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality, accessibility, performance validation, and cleanup across all stories.

- [x] T030 [P] Add Playwright end-to-end test for the full US1 chat flow in `extension/tests/e2e/chat.e2e.test.ts`: load a YouTube video, wait for knowledge panel, open chat tab, send a question, assert streaming response appears, close and reopen panel, assert history persists
- [x] T031 [P] Audit all new components (`ChatInput`, `ChatMessageBubble`, `ChatPanel`, `TabBar`, `BlogPostButton`) for WCAG 2.1 AA compliance: verify `aria-label` on all interactive elements, keyboard focus order is logical, and color contrast ratios pass
- [x] T032 Verify `chrome.storage.session` quota usage stays within the 10 MB limit for a 60-minute video by logging storage size after caching `Video` + `ChatSession`; add a size check warning to `chatCache.saveChatSession()` if combined usage exceeds 8 MB
- [x] T033 [P] Run ESLint and Prettier on all new and modified files (`extension/types/chat.ts`, `chatCache.ts`, `chatClient.ts`, all Chat components, `functions/src/chat/index.ts`, `chatOrchestrator.ts`, `functions/src/models/index.ts`); fix all warnings to zero
- [x] T034 Run all `quickstart.md` validation scenarios (1–7) end-to-end against the local dev environment; document any failures and resolve before marking the feature complete
- [x] T035 [P] Update `functions/host.json` CORS settings to confirm `chrome-extension://*` (or wildcard `*`) is included in `Access-Control-Allow-Origin` for the new `/api/chat` route, consistent with the existing `/api/analyze` configuration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001, T002, T003 can all run in parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion; T004, T005, T006 can run in parallel; T007 depends on T006
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion — BLOCKS until T007 is done; test tasks T008–T012 can run in parallel; implementation must follow test order
- **User Story 2 (Phase 4)**: Depends on Phase 3 checkpoint; T022–T023 (tests) can run in parallel; T024 must follow T022 pass; T025 can run parallel to T024; T026 depends on T025; T027 depends on T026
- **User Story 3 (Phase 5)**: Depends on Phase 3 checkpoint; T028 depends on Phase 3 chatOrchestrator; T029 can run parallel to T028
- **Polish (Phase 6)**: Depends on all desired story phases; T030–T033, T035 can run in parallel; T034 must be last

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational phase only — no dependency on US2 or US3
- **US2 (P2)**: Depends on US1 (reuses `chatClient`, `ChatPanel`, `ChatMessageBubble`)
- **US3 (P3)**: Depends on US1 (updates `chatOrchestrator` system prompt) — independent of US2

### Within Each User Story

- Tests MUST be written first and confirmed to FAIL (Constitution Principle II)
- Backend (`chatOrchestrator.ts`, `chat/index.ts`) before frontend (`chatClient.ts`, `ChatPanel.tsx`)
- Services before components
- Core component before panel wiring
- Panel wiring before App.tsx integration

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 — all parallel
- **Phase 2**: T004, T005, T006 — parallel; T007 sequential after T006
- **Phase 3 tests**: T008, T009, T010, T011, T012 — all parallel
- **Phase 3 impl**: T013 (chatCache) and T014 (chatOrchestrator) parallel; T015 (chat/index.ts) after T014; T016 (chatClient) after T015; T017, T018 parallel (UI leaf components); T019 (ChatPanel) after T016, T017, T018; T020 (TabBar) parallel to T019; T021 (App.tsx) after T019 and T020
- **Phase 4 tests**: T022, T023 — parallel
- **Phase 6**: T030, T031, T032, T033, T035 — all parallel; T034 last

---

## Parallel Execution Examples

### Phase 3 (US1) — Test Writing Sprint

```
Parallel:
  Task T008: "Unit tests for chatCache.ts in extension/tests/unit/chatCache.test.ts"
  Task T009: "Unit tests for chatClient.ts in extension/tests/unit/chatClient.test.ts"
  Task T010: "Unit tests for chatOrchestrator.ts in functions/tests/unit/chatOrchestrator.test.ts"
  Task T011: "Integration tests for POST /api/chat in functions/tests/integration/chat.integration.test.ts"
  Task T012: "Unit tests for sessionCache.ts storeVideo/getVideo in extension/tests/unit/sessionCache.test.ts"
```

### Phase 3 (US1) — UI Components Sprint

```
Parallel (after T016 chatClient is complete):
  Task T017: "Create ChatInput.tsx in extension/components/Chat/ChatInput.tsx"
  Task T018: "Create ChatMessageBubble.tsx in extension/components/Chat/ChatMessageBubble.tsx"
  Task T020: "Create TabBar.tsx in extension/components/shared/TabBar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007) — **CRITICAL BLOCKER**
3. Write all Phase 3 tests (T008–T012) — confirm they all FAIL
4. Complete Phase 3 implementation (T013–T021) — make all tests pass
5. **STOP and VALIDATE**: Run `quickstart.md` Scenarios 1–3, 6, 7
6. Demo/deploy MVP — interactive Q&A chat is live

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. User Story 1 → Chat Q&A live (MVP) — independently testable ✅
3. User Story 2 → Blog post generation added — independently testable ✅
4. User Story 3 → Deep-dive elaboration refined — independently testable ✅
5. Polish → Production-ready ✅

### Parallel Team Strategy

With two developers after Foundational phase:

- **Dev A**: T013 → T014 → T015 → T016 (backend + chat service)
- **Dev B**: T017 → T018 → T020 (UI leaf components)
- Merge: T019 (ChatPanel — depends on both) → T021 (App.tsx)

---

## Notes

- `[P]` tasks work on different files with no shared in-progress dependencies
- `[Story]` label maps each task to a specific user story for traceability
- Constitution mandates test-first: every implementation task MUST have a prior failing test
- Commit after each phase checkpoint, not mid-phase
- Validate `quickstart.md` at each phase checkpoint before starting the next story
- The `ChatPanel` (T019) is the most complex task — allocate extra time and write a focused unit test
