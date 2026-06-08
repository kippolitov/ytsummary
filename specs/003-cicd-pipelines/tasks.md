# Tasks: Automated CI/CD Pipelines

**Input**: Design documents from `/specs/003-cicd-pipelines/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/workflow-contracts.md](contracts/workflow-contracts.md), [quickstart.md](quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the GitHub Actions directory structure and workflow file scaffolds with correct triggers and job stubs before any job steps are filled in.

- [x] T001 Create `.github/` and `.github/workflows/` directories at repository root
- [x] T002 [P] Create scaffolded `.github/workflows/ci.yml` with trigger `on: push: branches-ignore: [main]`, `permissions: contents: read`, and an empty `jobs:` section
- [x] T003 [P] Create scaffolded `.github/workflows/cd.yml` with trigger `on: push: branches: [main]`, top-level `permissions: contents: read`, and four empty job stubs (`extension-ci`, `functions-ci`, `package-extension`, `deploy-functions`) with correct `needs:` relationships (`package-extension` needs `extension-ci`; `deploy-functions` needs `functions-ci`)

**Checkpoint**: `.github/workflows/ci.yml` and `.github/workflows/cd.yml` exist, are valid YAML skeletons, and GitHub Actions recognizes their triggers (verify by pushing the branch — Actions tab shows the workflows listed even with empty jobs).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No additional foundational infrastructure beyond Phase 1 is required; GitHub Actions, the Node.js toolchain, and both npm workspaces are already in place. This phase is intentionally minimal.

**⚠️ NOTE**: T002 and T003 from Phase 1 are the true foundational gate. Do not begin Phase 3 (US1) until both workflow file scaffolds are committed and pushed.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Feature Branch CI (Priority: P1) 🎯 MVP

**Goal**: Every push to a non-main branch runs lint, unit tests, and build for both `extension/` and `functions/` workspaces in parallel and reports pass/fail within 5 minutes.

**Independent Test**: Push an empty commit to a test feature branch; verify the `CI` workflow run appears in GitHub Actions with two parallel jobs (`extension-ci`, `functions-ci`) both passing. Then introduce a deliberate lint error in `extension/` and verify only the `extension-ci` job fails while `functions-ci` passes independently.

### Implementation for User Story 1

- [x] T004 [P] [US1] Implement `extension-ci` job body in `.github/workflows/ci.yml`: steps are `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: '20.x'`), `npm ci` (`working-directory: extension`), `npm run lint` (`working-directory: extension`), `npm test` (`working-directory: extension`), `npm run build` (`working-directory: extension`)
- [x] T005 [P] [US1] Implement `functions-ci` job body in `.github/workflows/ci.yml`: steps are `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: '20.x'`), `npm ci` (`working-directory: functions`), `npm run lint` (`working-directory: functions`), `npm test` (`working-directory: functions`), `npm run build` (`working-directory: functions`)
- [x] T006 [US1] Copy the completed `extension-ci` and `functions-ci` job bodies from `ci.yml` into the matching job stubs in `.github/workflows/cd.yml` so the main-branch pipeline also runs the same lint/test/build checks before packaging and deployment proceed

**Checkpoint**: User Story 1 is complete when both workflow files contain correct CI job steps, and a test branch push triggers a passing `CI` workflow run in GitHub Actions with both jobs green within 5 minutes.

---

## Phase 4: User Story 2 — Extension Packaging on Main (Priority: P2)

**Goal**: Every merge to `main` produces a password-protected `.zip` of the built extension; the password is generated at build time, masked in all logs, and stored back to the `EXTENSION_ZIP_PASSWORD` GitHub Secret; no password appears in source code or git history.

**Independent Test**: Merge a test PR to `main`; in the `CD` workflow run, verify the `package-extension` job completes successfully, an artifact named `extension-<SHA>` appears under the run's Artifacts section, the `EXTENSION_ZIP_PASSWORD` secret shows an updated timestamp in Settings, and searching the job log for any 8-character string matching `[A-Za-z0-9]{8}` returns no coherent matches (all secrets are masked as `***`).

### Implementation for User Story 2

- [x] T007 [US2] Implement `package-extension` job body in `.github/workflows/cd.yml` (this job already has `needs: [extension-ci]` from T003): steps are `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: '20.x'`), `npm ci` (`working-directory: extension`), `npm run build` (`working-directory: extension`), `npm run zip` (`working-directory: extension`, produces `.output/*.zip`), generate password (`PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8)`), mask password (`echo "::add-mask::$PASSWORD"`), create AES-256 password-protected archive via `7za`, update secret via `gh secret set EXTENSION_ZIP_PASSWORD` (uses `GH_PAT` env — GITHUB_TOKEN cannot write secrets), upload artifact via `actions/upload-artifact@v4`
- [x] T008 [US2] Add `GH_PAT` secret requirement to `package-extension` job in `.github/workflows/cd.yml`; `gh secret set` uses `env: GH_TOKEN: ${{ secrets.GH_PAT }}` (a repo-scoped PAT) since GITHUB_TOKEN lacks secrets-write capability

**Checkpoint**: User Story 2 is complete when a main merge produces a downloadable artifact and the `EXTENSION_ZIP_PASSWORD` secret is updated, with zero credential values visible in any CI log line.

---

## Phase 5: User Story 3 — Azure Functions Deployment on Main (Priority: P3)

**Goal**: Every merge to `main` deploys the Functions app to Azure using credentials held in GitHub Secrets; no credential value appears in logs.

**Independent Test**: Merge a test PR to `main`; verify the `deploy-functions` job in the `CD` workflow run completes successfully, the Azure Portal shows the updated deployment for the Function App, and the job log contains no recognizable credential values.

**Prerequisite**: The repo admin must configure `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` and `AZURE_FUNCTIONAPP_NAME` secrets in **Settings → Secrets and variables → Actions** before this job can succeed (see [quickstart.md](quickstart.md) — One-Time Secrets Setup).

### Implementation for User Story 3

- [x] T009 [US3] Implement `deploy-functions` job body in `.github/workflows/cd.yml` (this job already has `needs: [functions-ci]` from T003): steps are `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: '20.x'`), `npm ci` (`working-directory: functions`), `npm run build` (`working-directory: functions`, compiles TypeScript), `azure/functions-action@v1` with `app-name: ${{ secrets.AZURE_FUNCTIONAPP_NAME }}` and `publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}` and `package: functions/`

**Checkpoint**: User Story 3 is complete when the `deploy-functions` job succeeds on a main merge and the deployed Azure Functions version matches the merged commit.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reliability and UX improvements that affect all user stories.

- [x] T010 [P] Add `concurrency` group to `.github/workflows/ci.yml` to cancel in-progress runs for the same branch when a newer push arrives: `concurrency: group: ci-${{ github.ref }}  cancel-in-progress: true`
- [x] T011 [P] Add `concurrency` group to `.github/workflows/cd.yml` to serialize deployments on `main` and prevent concurrent deploys: `concurrency: group: cd-main  cancel-in-progress: false`
- [ ] T012 Run all 6 validation scenarios from `specs/003-cicd-pipelines/quickstart.md` against the implemented workflows and confirm all pass; document any failures and fix before closing the feature branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Merged into Phase 1 (T001–T003 are the gate)
- **US1 (Phase 3)**: Requires T001–T003 complete; T004 and T005 are parallel; T006 requires T004 and T005 to be done (so the correct content can be copied into cd.yml)
- **US2 (Phase 4)**: Requires T006 complete (cd.yml must have CI jobs before packaging job is added); T007 and T008 can proceed in parallel
- **US3 (Phase 5)**: Requires T006 complete; can proceed in parallel with US2 (different job in same file — no edit conflict if tasks are split by job)
- **Polish (Phase 6)**: Requires all user stories complete; T010 and T011 are parallel; T012 requires all previous tasks

### User Story Dependencies

- **US1 (P1)**: Depends only on Setup. No dependency on US2 or US3.
- **US2 (P2)**: Depends on US1 completion (T006) because cd.yml CI jobs must exist before `package-extension` is wired in.
- **US3 (P3)**: Depends on US1 completion (T006) for the same reason; independent of US2.

### Within Each User Story

- US1: T004 and T005 are parallel (different jobs in `ci.yml` and independent cd.yml stubs); T006 depends on both.
- US2: T007 and T008 are parallel (T008 is a single `permissions:` block addition; T007 is the full job body — no edit conflict).
- US3: Single task (T009).

---

## Parallel Opportunities

```
# Phase 1 parallel tasks (after T001):
Task T002: "Create ci.yml scaffold in .github/workflows/ci.yml"
Task T003: "Create cd.yml scaffold in .github/workflows/cd.yml"

# Phase 3 (US1) parallel tasks (after T002 and T003):
Task T004: "Implement extension-ci job in ci.yml"
Task T005: "Implement functions-ci job in ci.yml"
# → T006 follows when both T004 and T005 are done

# Phase 4 + Phase 5 parallel tasks (after T006):
Task T007: "Implement package-extension job body in cd.yml"
Task T008: "Add secrets:write permission to package-extension in cd.yml"
Task T009: "Implement deploy-functions job body in cd.yml"

# Phase 6 parallel tasks:
Task T010: "Add concurrency to ci.yml"
Task T011: "Add concurrency to cd.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 3: US1 (T004–T006)
3. **STOP and VALIDATE**: Push to a feature branch; confirm both CI jobs pass in GitHub Actions within 5 minutes
4. Merge to main (or wait) — US1 MVP is shippable

### Incremental Delivery

1. Phase 1 (Setup) → CI/CD directory and scaffolds ready
2. Phase 3 (US1) → Feature branch feedback loop working → **MVP**
3. Phase 4 (US2) → Secure extension packaging on main → **v1.1**
4. Phase 5 (US3) → Automated Azure deployment on main → **v1.2**
5. Phase 6 (Polish) → Concurrency control and full validation → **v1.2 hardened**

### Parallel Team Strategy

With two developers after Phase 1:

- Developer A: US1 (T004, T005, T006)
- Developer B: Can prepare Azure secrets and confirm publish profile availability while A works on US1
- After T006: Developer A → US2 (T007, T008); Developer B → US3 (T009)

---

## Notes

- `[P]` tasks operate on different files or independent sections — no same-file edit conflicts
- `[Story]` label maps each task to its user story for traceability
- All secrets (`AZURE_FUNCTIONAPP_PUBLISH_PROFILE`, `AZURE_FUNCTIONAPP_NAME`) must be configured before Phase 5 (US3) can be validated
- The `EXTENSION_ZIP_PASSWORD` secret is created automatically by T007 — do not pre-create it
- `::add-mask::` must be emitted before any step that could echo the password variable
- Commit after each phase checkpoint to keep the branch history clean and reviewable
