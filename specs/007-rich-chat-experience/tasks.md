# Tasks: Rich Chat Experience

**Input**: Design documents from `specs/007-rich-chat-experience/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/follow-up-prompts-api.md](./contracts/follow-up-prompts-api.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- Tests are included per constitution Principle II (test-first, Red-Green-Refactor)

## Path Conventions

- Extension UI: `extension/components/`, `extension/services/`, `extension/types/`, `extension/tests/`
- Backend: `functions/src/`

---

## Phase 1: Setup

**Purpose**: Install new markdown rendering dependencies and configure highlight.js themes.

- [x] T001 Add `remark-gfm`, `rehype-highlight`, and `highlight.js` to `extension/package.json` dependencies and run `npm install`
- [x] T002 [P] Import `highlight.js/styles/github.css` and `highlight.js/styles/github-dark.css` as conditional side-effect imports in `extension/entrypoints/sidepanel/main.tsx`, gated on the `dark` class to align with the existing dark-mode strategy

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type changes required by both US1 and US2. Must complete before any user story work begins.

**âš ï¸ CRITICAL**: Both user story phases depend on these type definitions.

- [x] T003 Extend `ChatMessageType` union to include `"follow-up-prompts"` and add `FollowUpPromptsRequest` and `FollowUpPromptsResponse` interfaces in `extension/types/chat.ts`
- [x] T004 [P] Extend the `ChatRequest` mode union to include `"follow-up-prompts"` and add a `isFollowUpPromptsRequest` type-guard function in `functions/src/models/index.ts`

**Checkpoint**: Type definitions complete â€” US1 and US2 can now proceed in parallel.

---

## Phase 3: User Story 1 â€” Read Structured, Formatted AI Responses (Priority: P1) ðŸŽ¯ MVP

**Goal**: AI chat responses render fully formatted rich markdown â€” headings, GFM tables, syntax-highlighted code blocks, callout blocks, bold/italic emphasis, and links that open in new tabs â€” replacing the current plain `<ReactMarkdown>` rendering.

**Independent Test**: Open the Chat tab on any YouTube video, ask "Give me a detailed breakdown with headings and a comparison table", and verify the response renders with visible section headings, a styled table, no raw markdown symbols, and any code blocks with syntax coloring.

### Tests for User Story 1 (Write First â€” Confirm Failure Before Implementing)

- [x] T005 [P] [US1] Write unit tests for `CalloutBlock` label detection: verifies that blockquotes starting with `**Key Insight**:`, `**Important**:`, `**Tip**:`, `**Warning**:`, `**Note**:`, `**Example**:` render as styled callout divs, and that non-matching blockquotes render as standard blockquotes â€” in `extension/tests/unit/CalloutBlock.test.tsx`
- [x] T006 [P] [US1] Write unit tests for `ChatMessageBubble` with GFM input: verify that a message containing a markdown table renders an `<table>` element, a fenced code block with language annotation renders with a `language-*` class, and a hyperlink renders with `target="_blank"` and `rel="noopener noreferrer"` â€” in `extension/tests/unit/ChatMessageBubble.test.tsx`

### Implementation for User Story 1

- [x] T007 [P] [US1] Create `CodeBlock.tsx`: a React component that receives `className` (e.g., `language-typescript`) and `children` props from rehype-highlight, renders a `<pre><code>` block with the highlight.js token classes, and falls back to a plain monospace block when no language class is present â€” in `extension/components/Chat/markdown/CodeBlock.tsx`
- [x] T008 [P] [US1] Create `CalloutBlock.tsx`: a React component that receives `children` from the react-markdown `blockquote` override, inspects the first child text node for a bold label matching `Key Insight | Important | Tip | Warning | Note | Example`, and renders either a styled callout div (left border + background tint + bold label) or a standard `<blockquote>` â€” in `extension/components/Chat/markdown/CalloutBlock.tsx`
- [x] T009 [US1] Create `markdownComponents.ts`: exports a `remarkPlugins` array (`[remarkGfm]`), a `rehypePlugins` array (`[rehypeHighlight]`), and a `components` object mapping `code` â†’ `CodeBlock` and `blockquote` â†’ `CalloutBlock`, with `a` overridden to add `target="_blank" rel="noopener noreferrer"` â€” in `extension/components/Chat/markdown/markdownComponents.ts`
- [x] T010 [US1] Update `ChatMessageBubble.tsx` to pass `remarkPlugins`, `rehypePlugins`, and `components` from `markdownComponents.ts` into the existing `<ReactMarkdown>` call, replacing the bare `<ReactMarkdown>{message.content}</ReactMarkdown>` invocation â€” in `extension/components/Chat/ChatMessageBubble.tsx`

**Checkpoint**: User Story 1 complete â€” formatted markdown responses render correctly. Can demo and validate independently before proceeding.

---

## Phase 4: User Story 2 â€” Explore the Conversation with Follow-Up Prompts (Priority: P2)

**Goal**: Three contextual follow-up prompt chips appear below each AI response within 2 seconds. Clicking a chip submits it as the next user message. Chips reset when a new message is sent. Silent failure if the follow-up API call fails.

**Independent Test**: Send any question in the Chat tab, wait for the full response, and verify three clickable chip buttons appear below it within 2 seconds. Click one chip and verify it appears as a new user message bubble and a new AI response begins loading.

### Tests for User Story 2 (Write First â€” Confirm Failure Before Implementing)

- [x] T011 [P] [US2] Write unit tests for `fetchFollowUpPrompts`: verify success case (returns `string[3]`), network error case (returns `[]`), malformed JSON response (returns `[]`), and messages array with fewer than 2 items (returns `[]` without making a request) â€” in `extension/tests/unit/followUpClient.test.ts`
- [x] T012 [P] [US2] Write unit tests for `FollowUpPromptChips`: verify three chip buttons render with the provided prompt text, clicking the first chip calls `onSelect` with the correct string, and when `isLoading` is true three skeleton placeholder elements render instead of chips â€” in `extension/tests/unit/FollowUpPromptChips.test.tsx`

### Implementation for User Story 2

- [x] T013 [US2] Add `generateFollowUpPrompts(req: ChatRequest): Promise<string[]>` to `functions/src/services/chatOrchestrator.ts`: builds a follow-up system prompt instructing the model to return exactly 3 questions as a JSON array, calls Azure OpenAI non-streaming, parses the response, and returns a `string[3]` array (or throws on parse failure)
- [x] T014 [US2] Update `functions/src/chat/index.ts` to detect `mode === "follow-up-prompts"` in the validated request: call `generateFollowUpPrompts`, return `application/json` body `{ "prompts": [...] }` instead of the SSE stream response
- [x] T015 [P] [US2] Create `followUpClient.ts`: exports `fetchFollowUpPrompts(req: FollowUpPromptsRequest): Promise<string[]>` that POSTs to `/api/chat` with the request body, reads the JSON response, validates `prompts` is a non-empty string array, and returns `[]` on any error (network, non-200, parse) â€” in `extension/services/followUpClient.ts`
- [x] T016 [P] [US2] Create `FollowUpPromptChips.tsx`: renders three chip `<button>` elements from a `prompts: string[]` prop, calls `onSelect(prompt)` on click, renders three skeleton `<div>` elements when `isLoading` is true, and renders nothing when `prompts` is empty â€” in `extension/components/Chat/FollowUpPromptChips.tsx`
- [x] T017 [US2] Update `ChatPanel.tsx` to: (a) add `followUpPrompts: string[]` and `isLoadingFollowUp: boolean` state; (b) after streaming completes and `accumulated` is non-empty, fire `fetchFollowUpPrompts` with the full updated message history and set state on resolution; (c) reset `followUpPrompts` to `[]` at the start of each `handleSend` call; (d) replace the hardcoded "Dive Deeper" button with `<FollowUpPromptChips prompts={followUpPrompts} isLoading={isLoadingFollowUp} onSelect={(p) => { setInputPrefill(undefined); void handleSend(p); }} />` after the last assistant message â€” in `extension/components/Chat/ChatPanel.tsx`

**Checkpoint**: User Story 2 complete â€” follow-up chips appear, submit on click, and reset correctly. US1 and US2 work together.

---

## Phase 5: User Story 3 â€” Scan and Navigate Long Responses (Priority: P3)

**Goal**: The AI system prompt instructs the model to produce structured, multi-section responses using headings, callout blocks for key insights, and tables for comparisons â€” ensuring the rich renderer in US1 is fully utilized in practice.

**Independent Test**: Ask the Chat tab "Give me a detailed breakdown of everything covered in this video" and verify the response contains at least two heading levels dividing named sections, and at least one callout-style blockquote with a bold label.

### Tests for User Story 3 (Write First â€” Confirm Failure Before Implementing)

- [x] T018 [US3] Write a unit test that calls `buildChatSystemPrompt("Test Video", "test transcript")` and asserts the returned string contains the words "headings", "callout", and "table" (or equivalent structural instruction keywords), confirming the prompt contains formatting guidance â€” in `functions/tests/unit/chatOrchestrator.test.ts`

### Implementation for User Story 3

- [x] T019 [US3] Update `buildChatSystemPrompt` in `functions/src/services/chatOrchestrator.ts` to append a formatting instruction block that tells the model to: use `##` headings to divide multi-section answers, use `> **Key Insight**:` callout blocks for important takeaways, use markdown tables for comparisons, use fenced code blocks with a language identifier for any code, and keep answers concise while structured
- [x] T020 [US3] Update `buildBlogPostSystemPrompt` in `functions/src/services/chatOrchestrator.ts` to reinforce use of `> **Key Insight**:` callouts for the most important takeaway in each section, consistent with the callout convention established in T019

**Checkpoint**: All three user stories complete. Long responses now render as structured, scannable knowledge articles.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, E2E coverage, and visual regression checks across all stories.

- [x] T021 [P] Add `role="note"` and an appropriate `aria-label` attribute to the styled callout div in `CalloutBlock.tsx`, and add `aria-label="Code block"` to the `<pre>` element in `CodeBlock.tsx`, satisfying constitution Principle III accessibility requirements â€” in `extension/components/Chat/markdown/CalloutBlock.tsx` and `extension/components/Chat/markdown/CodeBlock.tsx`
- [x] T022 Write an E2E test that: (1) opens the Chat tab on a test fixture video, (2) sends a question, (3) asserts a response renders with at least one heading, (4) asserts three follow-up chip buttons appear, (5) clicks the first chip, (6) asserts the chip text appears as a new user message â€” in `extension/tests/e2e/richChat.test.ts`
- [x] T023 [P] Verify highlight.js theme CSS imports in `extension/entrypoints/sidepanel/main.tsx` do not cause a flash of unstyled code (FOUC) on dark-mode toggle by loading the extension in dark mode and confirming code block colors are correct immediately on render
- [x] T024 Run all 7 scenarios in `specs/007-rich-chat-experience/quickstart.md` manually and mark each passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion â€” BLOCKS both US1 and US2
- **US1 (Phase 3)**: Depends on Foundational â€” no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Foundational â€” no dependency on US1 or US3 (but visually builds on US1 being in place)
- **US3 (Phase 5)**: Depends on Foundational â€” backend-only change, no UI dependency
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational â€” pure UI rendering change
- **US2 (P2)**: Independent after Foundational â€” new service + component + backend route addition
- **US3 (P3)**: Independent after Foundational â€” backend prompt update only; enhances US1 output in practice

### Within Each User Story

- Tests MUST be written first and confirmed to fail before implementation starts (Red-Green-Refactor per constitution)
- Parallel `[P]` tasks within a story can start simultaneously
- `markdownComponents.ts` (T009) depends on T007 and T008 completing
- `ChatMessageBubble.tsx` update (T010) depends on T009
- `ChatPanel.tsx` update (T017) depends on T015 and T016

### Parallel Opportunities

- T005 and T006 (US1 tests) can run in parallel
- T007 and T008 (US1 components) can run in parallel
- T011 and T012 (US2 tests) can run in parallel
- T015 and T016 (US2 service + component) can run in parallel
- T003 and T004 (foundational types) can run in parallel
- US1 (Phase 3) and US3 (Phase 5) can run in parallel after Foundational

---

## Parallel Example: User Story 1

```
# Write tests in parallel:
T005 â€” CalloutBlock unit tests
T006 â€” ChatMessageBubble unit tests

# After tests fail, implement in parallel:
T007 â€” CodeBlock.tsx
T008 â€” CalloutBlock.tsx

# Then sequentially:
T009 â€” markdownComponents.ts (depends on T007, T008)
T010 â€” ChatMessageBubble.tsx update (depends on T009)
```

## Parallel Example: User Story 2

```
# Write tests in parallel:
T011 â€” followUpClient unit tests
T012 â€” FollowUpPromptChips unit tests

# After tests fail, implement backend then frontend in parallel:
T013 â†’ T014 â€” chatOrchestrator + chat/index.ts (backend, sequential)
T015 â€” followUpClient.ts (frontend service, parallel with T013/T014)
T016 â€” FollowUpPromptChips.tsx (UI component, parallel with T013/T014)

# Then:
T017 â€” ChatPanel.tsx update (depends on T015, T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps)
2. Complete Phase 2: Foundational (type changes)
3. Complete Phase 3: User Story 1 (rich rendering)
4. **STOP and VALIDATE**: Formatted responses render correctly â€” demo this independently
5. Ship or continue to US2

### Incremental Delivery

1. Phase 1 + 2 â†’ Foundation ready
2. Phase 3: US1 â†’ Rich rendering ships (MVP)
3. Phase 4: US2 â†’ Follow-up chips ship
4. Phase 5: US3 â†’ Structured AI responses ship
5. Phase 6: Polish â†’ Full feature complete

### Parallel Team Strategy

After Phase 2 completes:
- Developer A: User Story 1 (pure UI, extension-only)
- Developer B: User Story 2 (new backend route + extension service + component)
- Developer C: User Story 3 (backend prompt update â€” smallest scope)

---

## Notes

- **[P]** tasks involve different files and have no dependencies on incomplete tasks in the same phase
- **[Story]** label maps each task to a user story for independent delivery tracking
- Constitution Principle II requires tests written and failing before implementation â€” do not skip
- Commit after each checkpoint (US1 done, US2 done, US3 done)
- Highlight.js CSS should be imported as a side effect, not inlined, to allow Vite to tree-shake unused languages
- The hardcoded "Dive Deeper" button in `ChatPanel.tsx` (lines 174â€“182) is replaced by `FollowUpPromptChips` in T017 â€” delete it entirely

