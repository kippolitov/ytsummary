---

description: "Task list for Sign-In and Saved History"
---

# Tasks: Sign-In and Saved History

**Input**: Design documents from `/specs/008-auth-saved-history/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included and REQUIRED, not optional — the project constitution (`.specify/memory/constitution.md`, Principle II) mandates test-first development, an 80% coverage floor on changed modules, real-fixture integration tests for external API interactions (here: Google token verification and Azure Table Storage), and end-to-end coverage of every P1 journey.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes an exact file path

## Path Conventions

Two projects, per plan.md: `extension/` (Chrome extension, React) and `functions/` (Azure Functions, Node/TypeScript). Paths below are relative to the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new dependencies and configuration both projects need before any feature code is written.

- [ ] T001 [P] Add `google-auth-library` and `@azure/data-tables` to `functions/package.json` dependencies and `azurite` to `functions/package.json` devDependencies; run install
- [ ] T002 [P] Add the `identity` permission and a `WXT_GOOGLE_OAUTH_CLIENT_ID` Vite `define` (mirroring the existing `WXT_AZURE_FUNCTION_URL` pattern) to `extension/wxt.config.ts`
- [ ] T003 [P] Add an Azurite start/stop test helper for Table Storage integration tests in `functions/tests/integration/tableStorageTestHelper.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared auth building blocks consumed by every user story (US1's gating, and every saved-video endpoint in US2/US3 that must also run through the same auth check).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Add `AuthenticatedUser` type and `unauthenticated`/`not-authorized` `FunctionError` codes in `functions/src/models/index.ts`
- [ ] T005 [P] Implement the `AllowedUsers` table read helper (`isAllowed(email): Promise<boolean>`, populate/read `sub`) in `functions/src/services/allowedUsersStore.ts`
- [ ] T006 Implement Google ID-token verification (via `google-auth-library`'s `verifyIdToken`) and the shared `withAuth(handler)` middleware in `functions/src/services/auth.ts` (depends on T004, T005)
- [ ] T007 [P] Create `extension/types/auth.ts` with `AuthState` and `AuthenticatedUser` types
- [ ] T008 Implement Google sign-in via `chrome.identity.launchWebAuthFlow` (response_type=id_token, nonce, redirect via `chrome.identity.getRedirectURL()`) with token + expiry persisted in `chrome.storage.local` in `extension/services/authClient.ts` (depends on T007)
- [ ] T009 Implement `extension/hooks/useAuth.ts` exposing sign-in state and sign-in/sign-out actions (depends on T008)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign In With an Authorized Google Account (Priority: P1) 🎯 MVP

**Goal**: Every extension feature (summary, chat, saved history) is inaccessible until the user signs in with Google; only accounts on the `AllowedUsers` list get through, everyone else sees an invitation-only message.

**Independent Test**: Install the extension fresh; confirm Summary/Chat are blocked pre-sign-in; sign in with an account manually seeded into `AllowedUsers` (via Azurite/Storage Explorer — the CLI ships in US5) and confirm access; sign in with an unseeded account and confirm the invitation-only message with no feature access.

### Tests for User Story 1

> Write these first; confirm they fail before implementing.

- [ ] T010 [P] [US1] Unit tests for `withAuth` (missing/malformed/expired/invalid-signature token, unverified email, account not in `AllowedUsers`, happy path) in `functions/tests/unit/auth.test.ts`
- [ ] T011 [P] [US1] Integration test: `analyze` and `chat` endpoints reject missing/invalid/unauthorized bearer tokens before any OpenAI call, and accept authorized ones, using recorded JWT fixtures + a stubbed JWKS response and an Azurite-backed `AllowedUsers` table, in `functions/tests/integration/auth.test.ts`
- [ ] T012 [P] [US1] Unit tests for `SignInGate` states (signed-out prompt, invitation-only message, authorized children render) in `extension/tests/unit/SignInGate.test.tsx`
- [ ] T013 [P] [US1] E2E test: unauthenticated user sees the sign-in prompt and cannot reach Summary/Chat; an unauthorized account sees the invitation-only message, in `extension/tests/e2e/signIn.test.ts`

### Implementation for User Story 1

- [ ] T014 [US1] Wrap `analyzeHandler` with `withAuth` in `functions/src/analyze/index.ts` (depends on T006)
- [ ] T015 [US1] Wrap `chatHandler` with `withAuth` in `functions/src/chat/index.ts` (depends on T006)
- [ ] T016 [P] [US1] Attach the `Authorization: Bearer <idToken>` header to requests in `extension/services/analysisClient.ts` (depends on T008)
- [ ] T017 [P] [US1] Attach the `Authorization: Bearer <idToken>` header to requests in `extension/services/chatClient.ts` (depends on T008)
- [ ] T018 [US1] Create `extension/components/Auth/SignInGate.tsx` rendering the sign-in prompt, invitation-only message, or authorized children based on `useAuth` state (depends on T009)
- [ ] T019 [US1] Wire `SignInGate` into `extension/entrypoints/sidepanel/App.tsx` to gate the Summary/Chat tabs and add a sign-out control (depends on T018)
- [ ] T020 [US1] Update `extension/entrypoints/background.ts` to hold auth state and silently refresh the ID token before expiry, falling back to an interactive sign-in prompt on failure (depends on T008)
- [ ] T021 [US1] Map the new `unauthenticated`/`not-authorized` error codes to the sign-in/invitation-only UI states in `extension/services/analysisClient.ts` and `extension/services/chatClient.ts` error handling (depends on T016, T017)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Save a Video's Summary and Chat for Later (Priority: P2)

**Goal**: A signed-in, authorized user can explicitly save a video's current summary and chat so both persist indefinitely, and see that a video is already saved when revisiting it.

**Independent Test**: Sign in, generate a summary, have a chat exchange, save the video, close and reopen the browser, and confirm the summary and chat are unchanged; revisiting the same video shows it as already saved.

### Tests for User Story 2

- [ ] T022 [P] [US2] Unit tests for `savedVideosStore` create/update and chat-history chunking (data-model.md §5) in `functions/tests/unit/savedVideosStore.test.ts`
- [ ] T023 [P] [US2] Unit tests for the save-or-update (`PUT`) and get-one (`GET /{videoId}`) handlers in `functions/tests/unit/savedVideos.handler.test.ts`
- [ ] T024 [P] [US2] Integration test: save-or-update then get-one round trip against Azurite in `functions/tests/integration/savedVideos.test.ts`
- [ ] T025 [P] [US2] Unit tests for `savedVideosClient.ts` save/get functions in `extension/tests/unit/savedVideosClient.test.ts`
- [ ] T026 [P] [US2] Unit tests for `SaveButton` (idle, saving, saved, error states) in `extension/tests/unit/SaveButton.test.tsx`

### Implementation for User Story 2

- [ ] T027 [P] [US2] Add `SavedVideo` request/response types, type guards, and the `not-found` `FunctionError` code in `functions/src/models/index.ts` (depends on T004)
- [ ] T028 [US2] Implement create/update/get-one in `functions/src/services/savedVideosStore.ts` per data-model.md, including chat-history chunking (depends on T027)
- [ ] T029 [US2] Register `PUT /api/saved-videos/{videoId}` and `GET /api/saved-videos/{videoId}`, each wrapped in `withAuth`, in `functions/src/auth/index.ts` (depends on T028, T006)
- [ ] T030 [P] [US2] Implement `saveVideo()` and `getSavedVideo()` in `extension/services/savedVideosClient.ts` (depends on T029, T008)
- [ ] T031 [US2] Implement `extension/components/Saved/SaveButton.tsx` with a saved-state indicator and non-blocking failure messaging (depends on T030)
- [ ] T032 [US2] Wire `SaveButton` into the Summary and Chat views (`extension/components/KnowledgePanel/KnowledgePanel.tsx`, `extension/components/Chat/ChatPanel.tsx`) (depends on T031)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Browse and Restore Saved Videos (Priority: P2)

**Goal**: A signed-in user opens a "Saved" view listing every saved video, can select one to fully restore its summary and chat, and can remove (unsave) entries.

**Independent Test**: Save two or more videos, open the Saved view, confirm both are listed with identifying info, select one and confirm full restore, then unsave one and confirm it disappears from the list.

### Tests for User Story 3

- [ ] T033 [P] [US3] Unit tests for the list (`GET`) and delete (`DELETE`) handlers, extending `functions/tests/unit/savedVideos.handler.test.ts`
- [ ] T034 [P] [US3] Integration test: list + delete round trip against Azurite, extending `functions/tests/integration/savedVideos.test.ts`
- [ ] T035 [P] [US3] Unit tests for `savedVideosClient.ts` list/delete functions, extending `extension/tests/unit/savedVideosClient.test.ts`
- [ ] T036 [P] [US3] Unit tests for `SavedList` (empty state, populated list) and `SavedVideoDetail` (restore) in `extension/tests/unit/SavedList.test.tsx` and `extension/tests/unit/SavedVideoDetail.test.tsx`
- [ ] T037 [P] [US3] E2E test: save a video, browse the Saved view, restore it, unsave it, in `extension/tests/e2e/savedHistory.test.ts`

### Implementation for User Story 3

- [ ] T038 [US3] Add `list()` and `delete()` to `functions/src/services/savedVideosStore.ts` (depends on T028)
- [ ] T039 [US3] Register `GET /api/saved-videos` and `DELETE /api/saved-videos/{videoId}`, each wrapped in `withAuth`, in `functions/src/auth/index.ts` (depends on T038, T029)
- [ ] T040 [P] [US3] Implement `listSavedVideos()` and `deleteSavedVideo()` in `extension/services/savedVideosClient.ts` (depends on T039)
- [ ] T041 [US3] Implement `extension/components/Saved/SavedList.tsx` with populated-list and empty states (FR-012/FR-017) (depends on T040)
- [ ] T042 [US3] Implement `extension/components/Saved/SavedVideoDetail.tsx` restoring summary + chat and allowing continued chatting on the restored, saved video (FR-013/FR-015) (depends on T040)
- [ ] T043 [US3] Add a "Saved" tab to the `TABS` array and render `SavedList`/`SavedVideoDetail` in `extension/entrypoints/sidepanel/App.tsx` (depends on T041, T042)

**Checkpoint**: User Stories 1, 2, and 3 all work independently — the core save/restore experience is complete.

---

## Phase 6: User Story 4 - Access Saved History From Any Device (Priority: P3)

**Goal**: Confirm and lock in that saved videos, summaries, and chat are available from any device signed in with the same Google account, with no extra sync step.

**Independent Test**: Save a video while signed in on one browser profile/machine; sign in with the same account on a separate profile/machine and confirm the same saved video, summary, and chat appear there.

### Tests for User Story 4

- [ ] T044 [P] [US4] Integration test: two independent authenticated requests sharing the same `sub` (simulating two devices) see identical, up-to-date data after either "device" updates it, in `functions/tests/integration/savedVideos.crossDevice.test.ts`

### Implementation for User Story 4

- [ ] T045 [US4] Ensure `extension/components/Saved/SavedVideoDetail.tsx` always fetches current state from the backend on open rather than relying on any locally cached copy (depends on T042)

**Checkpoint**: Cross-device behavior is verified by an automated integration test; two-profile manual validation per quickstart.md US4 section is the remaining human check (not automatable without two real signed-in Chrome profiles).

---

## Phase 7: User Story 5 - Developer Manages the Authorized User List (Priority: P3)

**Goal**: The developer can add or remove a Google account from `AllowedUsers` without shipping a new extension version or redeploying the backend.

**Independent Test**: Add a new account via the CLI, confirm it can sign in immediately; remove it via the CLI, confirm it's denied on its next attempt — no deployment involved either time.

### Tests for User Story 5

- [ ] T046 [P] [US5] Unit tests for the `AllowedUsers` management CLI (`add`/`remove`/`list`) against Azurite in `functions/tests/unit/manageAllowedUsers.test.ts`

### Implementation for User Story 5

- [ ] T047 [US5] Implement `functions/scripts/manage-allowed-users.ts` (`add <email>` / `remove <email>` / `list`) using `@azure/data-tables` directly against the configured storage connection string (depends on T005)
- [ ] T048 [US5] Add an `allowed-users` npm script entry invoking the CLI in `functions/package.json` (depends on T047)

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T049 [P] Audit `functions/src/services/auth.ts` and `functions/src/auth/index.ts` to ensure ID tokens and email addresses are never written to `context.log`/console output
- [ ] T050 [P] Document the new required environment variables (`GOOGLE_OAUTH_CLIENT_ID` for the backend audience check; confirm table names) in `functions/local.settings.json`'s tracked example/README and `extension/.env.local` example
- [ ] T051 Run full lint and typecheck across both projects (`npm run lint` and `npm run compile` in `extension/`; `npm run lint` and `npm run build` in `functions/`)
- [ ] T052 Execute the full `quickstart.md` validation walkthrough end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1's UI work but reuses `withAuth` from Foundational and the auth header plumbing US1 adds to `analysisClient.ts`/`chatClient.ts` is a separate file from `savedVideosClient.ts`, so US2 does not block on US1's phase completing
- **User Story 3 (Phase 5)**: Extends the same backend route file (`functions/src/auth/index.ts`) and store file (`savedVideosStore.ts`) that US2 creates — practically sequenced after US2
- **User Story 4 (Phase 6)**: Builds on US2/US3's saved-video storage and detail view — sequenced after US3
- **User Story 5 (Phase 7)**: Depends only on Foundational (`allowedUsersStore.ts`); independent of US2/US3/US4, could be pulled earlier if useful for manual testing of US1
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first and confirmed to fail before implementation (constitution Principle II)
- Models/types before services; services before endpoint registration; backend before the extension client that calls it; client service before the UI component that uses it

### Parallel Opportunities

- All Setup tasks (T001–T003) in parallel
- T004, T005 in parallel (Foundational); T007 in parallel with either
- Within US1: T010–T013 (tests) in parallel; T016/T017 in parallel; T014/T015 in parallel with each other but not with T016/T017 (different files, no shared dependency conflict — safe to run all four together)
- Within US2: T022–T026 (tests) in parallel; T030 depends on T029 so not parallel with it
- Within US3: T033–T037 (tests) in parallel
- US2 and US5 phases can be worked in parallel by different people once Foundational is done (both depend only on Foundational, not on each other)

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for withAuth in functions/tests/unit/auth.test.ts"
Task: "Integration test for analyze/chat auth enforcement in functions/tests/integration/auth.test.ts"
Task: "Unit tests for SignInGate in extension/tests/unit/SignInGate.test.tsx"
Task: "E2E sign-in gating test in extension/tests/e2e/signIn.test.ts"

# Then, backend wrapping and client header attachment together:
Task: "Wrap analyzeHandler with withAuth in functions/src/analyze/index.ts"
Task: "Wrap chatHandler with withAuth in functions/src/chat/index.ts"
Task: "Attach Authorization header in extension/services/analysisClient.ts"
Task: "Attach Authorization header in extension/services/chatClient.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything else)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md's US1 section independently (manually seed one `AllowedUsers` row via Azurite/Storage Explorer since the CLI is built in US5)
5. Demo: sign-in gating and invitation-only messaging work end-to-end

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP demo (sign-in gating)
3. US2 → validate → demo (explicit save persists indefinitely)
4. US3 → validate → demo (Saved view browse/restore/unsave)
5. US4 → validate (cross-device, mostly automated + one manual two-profile check)
6. US5 → validate (CLI-driven access management, no redeploy)
7. Polish

### Parallel Team Strategy

Once Foundational is done: one developer on US1 (client + backend gating), one on US2/US3 (saved-video storage/endpoints/UI, since they share files and are naturally sequential for one person but could split backend vs. extension work across two), one on US5 (independent CLI script) — all converge before Polish.
