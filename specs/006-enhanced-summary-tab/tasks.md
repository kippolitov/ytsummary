# Tasks: Enhanced Summary Tab — Knowledge Surface

**Input**: Design documents from `/specs/006-enhanced-summary-tab/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/analyze-api.md](contracts/analyze-api.md), [contracts/ui-components.md](contracts/ui-components.md)

**Scope**: 6 existing files modified + 1 new test file across `functions/` and `extension/`. No new dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])

---

## Phase 1: Setup (Review Scope)

**Purpose**: Identify every callsite that references the `summary` field before making type changes, to avoid missed renames causing silent runtime failures.

- [x] T001 Search `functions/src/`, `extension/components/`, `extension/types/`, and both `tests/unit/` directories for all references to `.summary` and `"summary"` to confirm the complete change surface matches the plan (expected: `models/index.ts`, `openaiOrchestrator.ts`, `openaiOrchestrator.test.ts`, `types/index.ts`, `SummarySection.tsx`, `KnowledgePanel.tsx`)

**Checkpoint**: Change surface confirmed. No additional files reference `summary`.

---

## Phase 2: Foundational (Type Contracts)

**Purpose**: Update the shared type definitions in both packages first. All downstream code that references `AnalysisResult.summary` or `AnalyzeResponse.summary` will produce TypeScript errors until this phase completes — use those errors as a guided checklist.

**⚠️ CRITICAL**: T003, T004, T006, and T007 all depend on T002 and T003 completing first. Do not proceed to Phase 3 until TypeScript compilation is clean after these two changes.

- [x] T002 [P] Update `functions/src/models/index.ts` — in `AnalyzeResponse`, remove `summary: string` and add `tldr: string[]`; the rest of the interface (videoId, topics, steps, references, analyzedAt) is unchanged
- [x] T003 [P] Update `extension/types/index.ts` — in `AnalysisResult`, remove `summary: string` and add `tldr: string[]`; the rest of the interface (videoId, topics, steps, references, analyzedAt) is unchanged

**Checkpoint**: Both type files compile. TypeScript will now surface errors in `openaiOrchestrator.ts`, `SummarySection.tsx`, and `KnowledgePanel.tsx` — these are the tasks in Phase 3.

---

## Phase 3: User Story 1 — TL;DR Bullet Section (Priority: P1) 🎯 MVP

**Goal**: The summary tab displays a scannable TL;DR bullet list (3–7 items) instead of a prose paragraph, enabling users to determine video relevance in under 30 seconds.

**Independent Test**: Open the side panel on any YouTube video with captions; confirm the first content section is labeled "TL;DR" and contains a bulleted list of 3–7 items; each item is a single complete sentence.

### Implementation for User Story 1

- [x] T004 [P] [US1] Update `functions/src/services/openaiOrchestrator.ts` — modify `buildPrompt()` to request `tldr` (array of 3–7 distinct bullet strings, each a complete sentence conveying one unique takeaway) instead of `summary`; update topic rules to request descriptions of 2–5 sentences including at least one insight not in the TL;DR, in chronological order; update `orchestrateAnalysis()` parse block to populate `tldr: rawTldr.filter(b => typeof b === "string").slice(0, 7)` instead of `summary`; see [contracts/analyze-api.md](contracts/analyze-api.md) for exact before/after prompt and parse code

- [x] T005 [US1] Update `functions/tests/unit/openaiOrchestrator.test.ts` — in the "parses valid JSON response" test, replace `summary: "Test summary."` fixture with `tldr: ["Bullet one.", "Bullet two."]` and change assertion from `expect(result.summary).toBe(...)` to `expect(result.tldr).toEqual(["Bullet one.", "Bullet two."])`; in the "prompt construction" test, replace the mock response payload `summary` field with `tldr: []`; confirm all tests pass (depends on T004)

- [x] T006 [P] [US1] Update `extension/components/sections/SummarySection.tsx` — change the component interface from `{ summary: string }` to `{ tldr: string[] }`; return `null` when `tldr.length === 0`; render a `<section>` with heading "TL;DR" (same heading style as existing uppercase tracking-widest pattern) and a `<ul aria-label="Key takeaways">` containing one `<li>` per bullet; see [contracts/ui-components.md](contracts/ui-components.md) for the full rendering contract

- [x] T007 [US1] Update `extension/components/KnowledgePanel/KnowledgePanel.tsx` — change `<SummarySection summary={result.summary} />` to `<SummarySection tldr={result.tldr} />`; no other changes to this file (depends on T006)

- [x] T008 [US1] Create `extension/tests/unit/SummarySection.test.tsx` — write four test cases: (1) `tldr=[]` renders nothing (container is empty); (2) `tldr=["one bullet"]` renders a `<ul>` containing exactly one `<li>`; (3) `tldr=["b1","b2","b3"]` renders three `<li>` elements; (4) the `<ul>` carries `aria-label="Key takeaways"`; use `@testing-library/react` render + screen pattern matching the existing `ReferencesSection.test.tsx` style (depends on T006)

**Checkpoint**: Run `npm test` in `extension/` and `functions/`. All tests pass. Build extension (`npm run build` in `extension/`). Load in Chrome. Open side panel on a YouTube video — TL;DR section appears with bullets.

---

## Phase 4: User Story 2 — Enriched Topic Descriptions (Priority: P2)

**Goal**: The Topics section renders 2–5 sentence descriptions with enough spacing and visual hierarchy for comfortable reading of longer content.

**Independent Test**: Open the side panel on any video with distinct topics; confirm each topic entry has a title and a multi-sentence description that contains detail not in the TL;DR section.

### Implementation for User Story 2

- [x] T009 [US2] Update `extension/components/sections/TopicsSection.tsx` — increase list item spacing from `space-y-3` to `space-y-5` to accommodate 2–5 sentence descriptions; increase description paragraph top margin from `mt-0.5` to `mt-1.5`; change topic name from `<span>` to `<h3>` element (keep same font classes: `text-sm font-semibold text-gray-900 dark:text-gray-100`) for semantic heading structure that enables keyboard and screen-reader navigation between topics

**Checkpoint**: Open panel on a topic-rich video; topics are visually distinct and readable without cramping; descriptions provide substantive depth beyond TL;DR bullets.

---

## Phase 5: User Story 3 — Revisit Content Navigation (Priority: P3)

**Goal**: Confirm that specific, descriptive topic titles (delivered by prompt change in T004) allow a returning user to locate a previously-read topic by scanning headings within 60 seconds.

**Independent Test**: After loading the panel once, close and reopen it on the same video; topic list is identical to the first load (deterministic session cache behavior unchanged).

### Validation for User Story 3

- [x] T010 [US3] Run quickstart Scenario 1 (TL;DR bullets render), Scenario 2 (topic descriptions are enriched), and Scenario 5 (`npm test` passes) from [quickstart.md](quickstart.md) against a locally-built extension; confirm: TL;DR section is first, has 3–7 bullets; Topics section has specific titles (not "Topic 1" style labels); closing and reopening the panel for the same video produces identical content

**Checkpoint**: All three quickstart scenarios pass. All three user stories are independently verified.

---

## Phase 6: Polish & Verification

**Purpose**: Ensure lint, type safety, and test coverage requirements from the Constitution are met before the feature is considered complete.

- [x] T011 [P] Run `npm run lint` in `extension/` and verify zero warnings; TypeScript strict mode compilation passes (`npx tsc --noEmit` inside `extension/`)
- [x] T012 [P] Run `npm run lint` in `functions/` and verify zero warnings; TypeScript compilation passes for functions package
- [x] T013 Run `npm run build` in `extension/` and confirm the build completes without errors and `extension/.output/chrome-mv3/` is produced; load the unpacked extension in Chrome and confirm the side panel opens without console errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — T002 and T003 run in parallel; both must complete before any Phase 3 work
- **US1 (Phase 3)**: Depends on Phase 2 — T004 and T006 can run in parallel (different packages); T005 depends on T004; T007 depends on T006; T008 depends on T006
- **US2 (Phase 4)**: Depends on Phase 3 (prompt change in T004 delivers richer topic content)
- **US3 (Phase 5)**: Depends on Phases 3 and 4 being complete
- **Polish (Phase 6)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational (T002, T003)
- **US2 (P2)**: Depends on US1 (T004 delivers prompt change that enriches topic descriptions)
- **US3 (P3)**: Depends on US1 and US2 being verifiable

### Within US1

- T004 [P] and T006 [P] are in different packages — can run in parallel after T002+T003
- T005 depends on T004 (tests must match the new parse output)
- T007 depends on T006 (passes new prop name)
- T008 depends on T006 (tests the new component interface)
- T007 and T008 can run in parallel (different files, both after T006)

---

## Parallel Execution Example: User Story 1

```
After T002 + T003 complete:

  ┌── T004: orchestrator prompt + parse (functions/)
  │     └── T005: update orchestrator tests (functions/)
  │
  └── T006: SummarySection component (extension/)
        ├── T007: KnowledgePanel pass-through (extension/)
        └── T008: SummarySection tests (extension/)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 — confirm change surface
2. T002 + T003 — update types (parallel)
3. T004 + T006 — implement changes (parallel)
4. T005, T007, T008 — complete tests and wiring
5. **STOP and VALIDATE**: Run quickstart Scenario 1 + Scenario 5
6. Proceed to US2 once TL;DR is confirmed working

### Incremental Delivery

1. T001 → T002+T003 → T004+T006 → T005+T007+T008 → US1 confirmed ✅
2. T009 → US2 confirmed ✅
3. T010 → US3 confirmed ✅
4. T011+T012+T013 → Constitution gates passed ✅

---

## Notes

- T002 and T003 remove `summary` and add `tldr` — TypeScript compilation errors after these two tasks are *expected* and serve as a guided change checklist for Phases 3–4
- `TopicsSection.tsx` receives no prompt-level changes — the richer descriptions come from the model via T004; the component change in T009 is purely presentational
- Session cache (`extension/services/sessionCache.ts`) stores `AnalysisResult` generically — no changes needed; TypeScript will verify compatibility at compile time
- `extension/services/sessionCache.ts` and `extension/entrypoints/background.ts` should be checked during T001 to confirm they do not reference `summary` directly
