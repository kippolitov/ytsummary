---
description: "Task list for Video Knowledge Panel browser extension"
---

# Tasks: Video Knowledge Panel

**Input**: Design documents from `specs/001-video-knowledge-panel/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included in all phases per Constitution Principle II (test-first is non-negotiable).
Tests MUST be written and confirmed to fail before implementation in each story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are included in every task description

## Path Conventions

- Extension: `extension/` at repository root
- Azure Function: `functions/` at repository root
- Tests: `extension/tests/` and `functions/tests/`

---

## Phase 1: Setup

**Purpose**: Initialize both sub-projects, configure tooling, define shared types.

- [X] T001 Initialize `extension/` WXT project: `npm create wxt@latest extension -- --template react-ts` and verify `extension/wxt.config.ts` and `extension/package.json` are created
- [X] T002 Initialize `functions/` Azure Functions project: `func init functions --worker-runtime node --language typescript` and verify `functions/host.json` and `functions/package.json` are created
- [X] T003 [P] Configure ESLint + Prettier for `extension/`: create `extension/.eslintrc.cjs` and `extension/.prettierrc` with TypeScript + React rules; add `lint` script to `extension/package.json`
- [X] T004 [P] Configure ESLint + Prettier for `functions/`: create `functions/.eslintrc.cjs` and `functions/.prettierrc` with TypeScript rules; add `lint` script to `functions/package.json`
- [X] T005 [P] Create shared TypeScript interfaces (Video, KnowledgePanelState, PanelStatus, AnalysisResult, Topic, ImplementationStep, Reference, PanelError) in `extension/types/index.ts`
- [X] T006 [P] Create Azure Function request/response TypeScript interfaces (AnalyzeRequest, AnalyzeResponse, FunctionError) in `functions/src/models/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on — side panel registration,
Tailwind CSS, session cache helpers, message type constants, CORS config.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Configure `extension/wxt.config.ts`: add `sidePanel`, `storage`, `scripting`, `activeTab` permissions; set `side_panel.default_path`; integrate Tailwind CSS via PostCSS; configure `WXT_AZURE_FUNCTION_URL` and `WXT_AZURE_FUNCTION_KEY` build-time env variables
- [X] T008 [P] Configure `functions/host.json`: set `extensionBundle.id`, CORS `allowedOrigins` (wildcard for dev), request timeout 50 s; add `start` script to `functions/package.json` using Azure Functions Core Tools
- [X] T009 [P] Install and configure Tailwind CSS in `extension/`: create `extension/tailwind.config.ts` and `extension/postcss.config.ts`; add base styles to `extension/assets/main.css`
- [X] T010 Create session cache helpers in `extension/services/sessionCache.ts`: `getResult(videoId)`, `setResult(videoId, result)`, `hasResult(videoId)` using `chrome.storage.session`
- [X] T011 [P] Define extension message type constants and payloads in `extension/types/messages.ts`: `TRANSCRIPT_READY`, `NO_TRANSCRIPT`, `VIDEO_CHANGED`, `ANALYSIS_RESULT`, `ANALYSIS_ERROR`, `RETRY_ANALYSIS`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Instant Knowledge Panel (Priority: P1) 🎯 MVP

**Goal**: User visits a YouTube video page → panel activates automatically → loading indicator
appears within 3 s → summary, topics, and any available sections populate within 30 s.

**Independent Test**: Navigate to any YouTube video with captions; confirm the knowledge panel
populates all detected sections within 30 s without pressing play.

### Tests for User Story 1 ⚠️ Write FIRST — confirm they FAIL before implementing

- [X] T012 [P] [US1] Unit test for transcript extractor: parsing timedtext XML → plain text, handling missing `captionTracks`, empty XML in `extension/tests/unit/transcriptExtractor.test.ts`
- [X] T013 [P] [US1] Unit test for session cache helpers: get on empty cache returns null, set then get returns value, distinct videoIds are isolated in `extension/tests/unit/sessionCache.test.ts`
- [X] T014 [P] [US1] Unit test for `openaiOrchestrator`: prompt construction contains transcript, JSON response parsed into AnalysisResult, malformed JSON throws structured error in `functions/tests/unit/openaiOrchestrator.test.ts`
- [X] T015 [P] [US1] Integration test for `POST /api/analyze`: happy path using recorded msw fixture (real Azure OpenAI response), missing `videoId` returns 400, empty transcript returns 400 in `functions/tests/integration/analyze.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Implement `extension/services/transcriptExtractor.ts`: read `ytInitialPlayerResponse` from `window`, extract first `captionTracks[0].baseUrl`, fetch timedtext XML (`fmt=srv1`), concatenate `<s>` text nodes into plain string; return `null` when no tracks available
- [X] T017 [US1] Implement `extension/entrypoints/content.ts`: on `document_idle` on `youtube.com/watch*`, read `ytInitialPlayerResponse` for video metadata, call `transcriptExtractor`; send `TRANSCRIPT_READY` (with Video payload) or `NO_TRANSCRIPT` (with videoId) to background via `chrome.runtime.sendMessage`
- [X] T018 [US1] Implement `extension/services/analysisClient.ts`: `POST` to `WXT_AZURE_FUNCTION_URL` with `x-functions-key` header and 45 s timeout; map HTTP 400/422/429/500/503 status codes to `PanelError` instances
- [X] T019 [US1] Implement `functions/src/analyze/index.ts`: validate request body against `AnalyzeRequest` schema; call `openaiOrchestrator`; return 200 `AnalyzeResponse` or structured error JSON for 400/422/500
- [X] T020 [US1] Implement `functions/src/services/openaiOrchestrator.ts`: build system prompt (summary + topics + steps + references schema); call Azure OpenAI `gpt-4o-mini` with `response_format: { type: "json_object" }`; parse and validate JSON into `AnalyzeResponse`
- [X] T021 [US1] Complete background service worker in `extension/entrypoints/background.ts`: handle `TRANSCRIPT_READY` — check session cache via `sessionCache.hasResult` → cache hit: send `ANALYSIS_RESULT` directly; cache miss: call `analysisClient.post`, store result via `sessionCache.setResult`, send `ANALYSIS_RESULT` to side panel; handle `NO_TRANSCRIPT` → send `ANALYSIS_ERROR` with no-transcript PanelError
- [X] T022 [P] [US1] Create `extension/components/shared/LoadingIndicator.tsx`: animated spinner with accessible `role="status"` and `aria-label`; visible while `status === 'loading'`
- [X] T023 [P] [US1] Create `extension/components/sections/SummarySection.tsx`: renders `summary` string in a styled paragraph; requires non-empty string prop
- [X] T024 [P] [US1] Create `extension/components/sections/TopicsSection.tsx`: renders `Topic[]` as a styled list; each item shows `name` (bold) and `description`; omitted when array is empty
- [X] T025 [US1] Create `extension/components/KnowledgePanel/KnowledgePanel.tsx`: composes `SummarySection`, `TopicsSection` (+ later StepsSection, ReferencesSection) conditionally; accepts `AnalysisResult` prop; sections render only when their data array is non-empty
- [X] T026 [US1] Implement side panel root `extension/entrypoints/sidepanel/App.tsx`: subscribe to `ANALYSIS_RESULT` and `ANALYSIS_ERROR` messages from background; manage `KnowledgePanelState` in React state; render `LoadingIndicator` when `status === 'loading'`, `KnowledgePanel` when `status === 'ready'`
- [X] T027 [US1] Create side panel entry `extension/entrypoints/sidepanel/index.html`: minimal HTML shell that mounts the React app; includes Tailwind base styles

**Checkpoint**: User Story 1 should be independently functional — panel opens, loads, and displays summary + topics for a captioned YouTube video.

---

## Phase 4: User Story 2 — Viewing Decision Support (Priority: P2)

**Goal**: User navigates between YouTube videos; panel automatically clears and re-analyzes each
new video without a page reload.

**Independent Test**: Open two YouTube videos in sequence; confirm the panel resets and fully
repopulates with distinct content for each video.

### Tests for User Story 2 ⚠️ Write FIRST — confirm they FAIL before implementing

- [X] T028 [P] [US2] Unit test for content script SPA navigation: `yt-navigate-finish` event triggers `VIDEO_CHANGED` message with new `videoId` in `extension/tests/unit/content.navigation.test.ts`
- [X] T029 [P] [US2] E2e test: navigate to Video A → panel populates → navigate to Video B → panel shows loading → panel populates with Video B content, Video A content no longer visible in `extension/tests/e2e/navigation.test.ts`

### Implementation for User Story 2

- [X] T030 [US2] Add `yt-navigate-finish` event listener to `extension/entrypoints/content.ts`: on each navigation event, re-read `ytInitialPlayerResponse`, send `VIDEO_CHANGED` (with new videoId) followed by `TRANSCRIPT_READY` or `NO_TRANSCRIPT` (re-runs full extraction flow)
- [X] T031 [US2] Handle `VIDEO_CHANGED` in `extension/entrypoints/sidepanel/App.tsx`: reset `KnowledgePanelState` to `{ status: 'loading' }` on receipt; clear previous analysis result from display (depends on T026)
- [X] T032 [P] [US2] Add video title and channel name header to `extension/components/KnowledgePanel/KnowledgePanel.tsx`: display current video title above sections so user can confirm which video is being analyzed (depends on T025)

**Checkpoint**: User Stories 1 AND 2 should both work independently — single-video analysis and multi-video navigation both functional.

---

## Phase 5: User Story 3 — Implementation Step Extraction (Priority: P3)

**Goal**: For tutorial and how-to videos, the panel displays an ordered Steps section; the section
is absent for non-procedural videos.

**Independent Test**: Open a step-by-step tutorial video — Steps section appears with ordered
instructions. Open an opinion piece — Steps section is absent.

### Tests for User Story 3 ⚠️ Write FIRST — confirm they FAIL before implementing

- [X] T033 [P] [US3] Unit test for `StepsSection`: renders ordered list when `steps` is non-empty, renders nothing (no DOM output) when `steps` is empty array in `extension/tests/unit/StepsSection.test.ts`
- [X] T034 [P] [US3] Unit test for `openaiOrchestrator` steps extraction: tutorial transcript produces non-empty `steps` array; opinion piece transcript produces empty `steps` array in `functions/tests/unit/openaiOrchestrator.steps.test.ts`

### Implementation for User Story 3

- [X] T035 [P] [US3] Create `extension/components/sections/StepsSection.tsx`: renders `ImplementationStep[]` as a numbered list (`order` + `text`); returns `null` when `steps` prop is an empty array
- [X] T036 [US3] Integrate `StepsSection` into `extension/components/KnowledgePanel/KnowledgePanel.tsx`: conditionally render `<StepsSection steps={result.steps} />` after TopicsSection (depends on T025, T035)

**Checkpoint**: All three stories (P1, P2, P3) work independently — panel shows steps for tutorials, omits section for non-tutorial content.

---

## Phase 6: User Story 4 — Resource Discovery (Priority: P4)

**Goal**: For videos where the presenter names tools or resources, the panel displays a References
section; it is absent for videos with no named resources.

**Independent Test**: Open a conference talk where tools are named — References section lists them.
Open a video with no named resources — References section is absent.

### Tests for User Story 4 ⚠️ Write FIRST — confirm they FAIL before implementing

- [X] T037 [P] [US4] Unit test for `ReferencesSection`: renders reference list with clickable URLs when available, non-linked name+description when URL is null; returns nothing when `references` is empty in `extension/tests/unit/ReferencesSection.test.ts`

### Implementation for User Story 4

- [X] T038 [P] [US4] Create `extension/components/sections/ReferencesSection.tsx`: renders `Reference[]` as a list; each item shows `name` (bold), `description`, and `context`; `url` renders as `<a target="_blank" rel="noopener noreferrer">`; returns `null` when `references` prop is empty array
- [X] T039 [US4] Integrate `ReferencesSection` into `extension/components/KnowledgePanel/KnowledgePanel.tsx`: conditionally render `<ReferencesSection references={result.references} />` after StepsSection (depends on T036, T038)

**Checkpoint**: All four user stories work independently — complete knowledge panel with all sections rendering conditionally.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error states, accessibility, styling, coverage gate, lint gate.

- [X] T040 [P] Create `extension/components/shared/ErrorMessage.tsx`: accepts `PanelError` prop; renders `error.message` (plain language), `error.action` (suggested next step), and a **Retry** button when `error.retryable === true`; button has accessible `aria-label`
- [X] T041 [P] Handle `NO_TRANSCRIPT` state in `extension/entrypoints/sidepanel/App.tsx`: when `status === 'no-transcript'`, render a plain-language message with suggested action (no `ErrorMessage` retry button needed); depends on T026
- [X] T042 Handle `ANALYSIS_ERROR` in `extension/entrypoints/background.ts`: map `analysisClient` error codes (`network-error`, `service-error`, `rate-limited`, `transcript-too-long`, `unknown`) to `PanelError` with `message` and `action` strings; send `ANALYSIS_ERROR` to side panel; implement 10 s backoff for `rate-limited` before forwarding error
- [X] T043 Handle `ANALYSIS_ERROR` in `extension/entrypoints/sidepanel/App.tsx`: when `status === 'error'`, render `<ErrorMessage error={error} onRetry={handleRetry} />`; depends on T026, T040
- [X] T044 [P] Implement retry handler in `extension/entrypoints/sidepanel/App.tsx`: on `RETRY_ANALYSIS`, set `status` back to `'loading'`; send `RETRY_ANALYSIS` message to background; background re-triggers `analysisClient.post`; depends on T042, T043
- [X] T045 [P] Apply Tailwind CSS utility classes to all components: consistent spacing, typography, color palette; side panel width constrained to 400 px; sections use card-style layout with clear headings
- [X] T046 [P] Add WCAG 2.1 AA accessibility attributes: all interactive elements have `aria-label`; color contrast ratios verified; `LoadingIndicator` has `role="status" aria-live="polite"`; `ReferencesSection` links have visible focus ring
- [X] T047 [P] E2e test for no-transcript scenario: navigate to a video without captions; verify no-transcript message appears and retry button is absent in `extension/tests/e2e/noTranscript.test.ts`
- [X] T048 [P] E2e test for error + retry scenario: mock Azure Function to return 500; verify error message and retry button appear; restore mock; click retry; verify panel loads successfully in `extension/tests/e2e/errorRetry.test.ts`
- [X] T049 [P] Run coverage: `npm run coverage` in both `extension/` and `functions/`; fix any module below 80% threshold per Constitution QG-2
- [X] T050 Final lint pass: `npm run lint` in `extension/` and `functions/`; resolve all warnings to zero per Constitution QG-1

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core pipeline, blocks nothing else but must complete first for MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2; integrates with US1 App.tsx (T026) — start after T026 complete
- **User Story 3 (Phase 5)**: Depends on Phase 2; integrates with KnowledgePanel (T025) — start after T025 complete
- **User Story 4 (Phase 6)**: Depends on Phase 5 (T036) — start after T036 complete
- **Polish (Phase 7)**: Depends on Phases 3–6 core complete

### User Story Dependencies

- **US1 (P1)**: Fully independent after Foundational phase
- **US2 (P2)**: Depends on US1's App.tsx (T026) for navigation reset; independent otherwise
- **US3 (P3)**: Depends on US1's KnowledgePanel (T025) for integration; otherwise independent
- **US4 (P4)**: Depends on US3's KnowledgePanel integration (T036)

### Within Each User Story

- Tests MUST be written and confirmed to FAIL before implementation
- Backend (`functions/`) tasks can proceed in parallel with extension UI tasks within the same story
- Models before services; services before entry points
- Components before panel integration

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run in parallel after T001 and T002
- T003, T004, T005, T006 are fully parallelizable
- Within Phase 3: T012–T015 (tests) are fully parallel; T016–T018 (extension services) and T019–T020 (function) can run in parallel pairs
- Within Phase 3: T022, T023, T024 (components) are fully parallel
- US3 and US2 can proceed in parallel once their respective blockers complete

---

## Parallel Examples

### Phase 3 — User Story 1 (after tests pass)

```bash
# Extension services and function backend in parallel:
Task A: "Implement transcriptExtractor.ts" (T016)
Task B: "Implement Azure Function handler in functions/src/analyze/index.ts" (T019)
Task C: "Implement openaiOrchestrator.ts" (T020)

# UI components in parallel (after T016 starts):
Task D: "Create LoadingIndicator.tsx" (T022)
Task E: "Create SummarySection.tsx" (T023)
Task F: "Create TopicsSection.tsx" (T024)
```

### Phase 3–5 cross-story parallelism

```bash
# Once T026 (App.tsx) and T025 (KnowledgePanel) are done:
Task A: "US2 — Add yt-navigate-finish handler" (T030)
Task B: "US3 — Create StepsSection.tsx" (T035)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 — tests first, then implementation
4. **STOP and VALIDATE**: Install extension in Chrome; open a captioned YouTube video;
   confirm panel appears with summary + topics within 30 s (Quickstart Scenario 1)
5. Demo or ship MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → install + validate in Chrome → MVP!
3. US2 → test independently → confirm navigation refresh works
4. US3 → test independently → confirm steps section for tutorial videos
5. US4 → test independently → confirm references section for resource-heavy talks
6. Polish → all error states, accessibility, coverage gate, lint gate

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 + Phase 2 together
2. Once Foundational complete:
   - Dev A: US1 extension services (T016–T018) + side panel (T021–T027)
   - Dev B: US1 Azure Function (T019–T020)
3. Once US1 complete and validated:
   - Dev A: US2 navigation (T028–T032)
   - Dev B: US3 steps (T033–T036)
4. US4 + Polish in final pass

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [USN] label maps task to a specific user story for traceability
- Constitution Principle II requires tests written and failing BEFORE implementation — never skip
- Each user story checkpoint is independently validatable using `quickstart.md` scenarios
- Verify lint zero-warning and ≥ 80% coverage before closing any story (QG-1 / QG-2)
- Avoid committing TODO comments without an associated issue reference (QG-1)
