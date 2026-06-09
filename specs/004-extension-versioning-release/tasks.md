# Tasks: Extension Versioning and Secure Release Distribution

**Input**: Design documents from `/specs/004-extension-versioning-release/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/release-workflow.md ✅, quickstart.md ✅

**Tests**: Not included — feature spec does not request TDD or test tasks. Validation is performed via quickstart.md end-to-end scenarios in the Polish phase.

**Organization**: Tasks are grouped by user story. All three stories are implemented in a single new file (`.github/workflows/release.yml`); tasks are sequential within that file but logically scoped per story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on another in-progress task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All tasks include exact file paths

---

## Phase 1: Setup

**Purpose**: Create the workflow file skeleton and document the release process.

- [x] T001 Create `.github/workflows/release.yml` with `push: tags: 'v[0-9]+.[0-9]+.[0-9]+'` trigger, `concurrency` group `release-${{ github.ref_name }}` with `cancel-in-progress: false`, `permissions: contents: write`, and an empty `release` job targeting `ubuntu-latest`
- [x] T002 [P] Add a "Release Process" section to `README.md` documenting the release steps: bump `extension/package.json` version, commit, create and push a `vMAJOR.MINOR.PATCH` git tag, confirm that the `Release` workflow runs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the authoritative version source is correct and the existing pipeline is unaffected.

**⚠️ CRITICAL**: Verify these facts before implementing user story steps — the version format and existing secrets must be in place.

- [x] T003 Verify `extension/package.json` has `"version": "0.0.1"` (MAJOR.MINOR.PATCH format) — if the current value is correct, no edit is needed; confirm the `GH_PAT` secret exists in repository settings (required for `gh secret set` in T010)
- [x] T004 Confirm `.github/workflows/ci.yml` and `.github/workflows/cd.yml` have no `tags` trigger and will NOT fire on a version tag push — no edits should be needed; document confirmation in a PR comment or commit message

**Checkpoint**: Foundation confirmed — user story implementation can begin.

---

## Phase 3: User Story 1 — Automatic Version Stamping on Release (Priority: P1) 🎯 MVP

**Goal**: The release job reads the version from `extension/package.json`, validates it matches the pushed tag, and rejects duplicate releases — before any artifact is produced.

**Independent Test**: Push a tag `v0.0.1` with `extension/package.json` at `"version": "0.0.1"` → job reaches the Node.js setup step without error. Then push `v0.0.1` again (after deleting the remote tag) → job fails at "Check for duplicate release". Then push `v0.0.2` with `package.json` still at `0.0.1` → job fails at "Validate version matches tag". See quickstart.md Scenarios 1–3.

### Implementation for User Story 1

- [x] T005 [US1] Add `actions/checkout@v4` step with `fetch-depth: 0` to the `release` job in `.github/workflows/release.yml` (full history is required for `--generate-notes` to find the previous tag in Phase 5)
- [x] T006 [US1] Add "Validate version matches tag" step to `.github/workflows/release.yml`: read `PKG_VERSION` via `jq -r '.version' extension/package.json`, derive `TAG_VERSION` via `${GITHUB_REF_NAME#v}`, exit 1 with a clear error message if they differ, otherwise write `VERSION=$PKG_VERSION` to `$GITHUB_ENV`
- [x] T007 [P] [US1] Add "Check for duplicate release" step to `.github/workflows/release.yml`: run `gh release view "$GITHUB_REF_NAME" &>/dev/null` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; if it succeeds (release exists), exit 1 with a clear error message

**Checkpoint**: Push a correctly-versioned tag → pipeline validates and proceeds past these three steps. Mismatch or duplicate → pipeline fails fast with a descriptive error.

---

## Phase 4: User Story 2 — Password-Protected Archive (Priority: P2)

**Goal**: The pipeline runs the full CI gate, builds the extension, and produces a password-protected `ytsummary-v{version}.7z` archive — password masked in all logs and stored in `EXTENSION_ZIP_PASSWORD`.

**Independent Test**: After a successful run through Phase 3 steps, add Phase 4 steps and trigger the workflow — confirm `EXTENSION_ZIP_PASSWORD` is updated in repository Secrets and a `ytsummary-v{version}.7z` file is present as a local artifact (before the release step exists). See quickstart.md Scenario 4.

### Implementation for User Story 2

- [x] T008 [US2] Add `actions/setup-node@v4` step (node-version `20.x`, cache `npm`, cache-dependency-path `extension/package-lock.json`) and "Install dependencies" step (`npm ci` in `extension/`) to `.github/workflows/release.yml`
- [x] T009 [P] [US2] Add "Lint" (`npm run lint`), "Unit tests" (`npm test`), and "Build extension" (`npm run build`) steps — all with `working-directory: extension` — to `.github/workflows/release.yml`
- [x] T010 [US2] Add "Zip extension" step (`npm run zip` in `extension/`) to `.github/workflows/release.yml`
- [x] T011 [US2] Add "Create password-protected archive" step to `.github/workflows/release.yml`:
  - Generate 8-char alphanumeric password: `openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8`
  - Mask immediately: `echo "::add-mask::$PASSWORD"`
  - Set archive name: `ARCHIVE="ytsummary-v${{ env.VERSION }}.7z"`
  - Create AES-256 archive with header encryption: `7za a -p"$PASSWORD" -mhe=on "$ARCHIVE" extension/.output/*.zip`
  - Write `ARCHIVE=$ARCHIVE` to `$GITHUB_ENV`
  - Store password: `gh secret set EXTENSION_ZIP_PASSWORD -b "$PASSWORD" --repo "$GITHUB_REPOSITORY"` with `GH_TOKEN: ${{ secrets.GH_PAT }}`

**Checkpoint**: Successful run produces `ytsummary-v{version}.7z` in the runner workspace; `EXTENSION_ZIP_PASSWORD` is updated; no password visible in job logs.

---

## Phase 5: User Story 3 — GitHub Release Creation with Archive Attachment (Priority: P3)

**Goal**: The pipeline creates a tagged GitHub Release and attaches the archive as the sole downloadable asset — with no archive committed to the repository.

**Independent Test**: After a full workflow run, navigate to the repository Releases page and confirm a release tagged `v{version}` exists with auto-generated notes and `ytsummary-v{version}.7z` as a downloadable asset. See quickstart.md Scenario 1.

### Implementation for User Story 3

- [x] T012 [US3] Add "Create GitHub Release" step to `.github/workflows/release.yml`: run `gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --generate-notes "${{ env.ARCHIVE }}"` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`

**Checkpoint**: Full workflow run creates a GitHub Release with the archive attached. The archive is not present anywhere in the repository tree.

---

## Phase 6: Polish & Validation

**Purpose**: End-to-end validation against all quickstart.md scenarios and final cleanup.

- [ ] T013 Validate quickstart.md Scenario 1 (happy path): bump `extension/package.json` to `"version": "0.1.0"`, commit, tag `v0.1.0`, push — confirm GitHub Release `v0.1.0` appears with `ytsummary-v0.1.0.7z` asset
- [ ] T014 [P] Validate quickstart.md Scenario 2 (duplicate rejection): attempt to push tag `v0.1.0` again after deleting and re-creating it locally — confirm pipeline fails at "Check for duplicate release" before creating any artifact
- [ ] T015 [P] Validate quickstart.md Scenario 3 (tag-version mismatch): push tag `v0.2.0` while `package.json` still has `0.1.0` — confirm pipeline fails at "Validate version matches tag"
- [ ] T016 [P] Validate quickstart.md Scenario 4 (password masking): open the completed release workflow run in GitHub Actions → expand "Create password-protected archive" step → confirm no plaintext password appears in logs
- [ ] T017 [P] Validate quickstart.md Scenario 5 (CD pipeline unaffected): push a normal commit to `main` — confirm only `cd.yml` fires, not `release.yml`
- [ ] T018 [P] Verify downloaded archive is password-protected: download `ytsummary-v0.1.0.7z` from the GitHub Release, attempt `7za e` without password (expect failure), attempt with correct password retrieved via `gh secret list` and out-of-band sharing (expect success)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 can run in parallel
- **Foundational (Phase 2)**: Requires T001 complete; T003 and T004 can run in parallel
- **US1 (Phase 3)**: Requires Foundational complete; T005 → T006 → T007 (sequential within file)
- **US2 (Phase 4)**: Requires US1 complete (steps are sequential in the same workflow file); T008 → T009 → T010 → T011
- **US3 (Phase 5)**: Requires US2 complete; T012 is the single step
- **Polish (Phase 6)**: Requires US3 complete; T013 first (establishes real release), then T014–T018 in parallel

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 + Phase 2 only — first independently testable increment
- **US2 (P2)**: Depends on US1 steps being in place (same workflow file, sequential)
- **US3 (P3)**: Depends on US2 steps being in place (same workflow file, sequential)

### Within Each Phase

- Steps within the `release` job run in the order they appear in the YAML — authoring follows the same sequential order
- Tasks marked [P] within a phase can be drafted/reviewed simultaneously if two developers are working; they must be merged carefully since they edit the same file

---

## Parallel Opportunities

```bash
# Phase 1 — can start these at the same time:
Task T001: "Create .github/workflows/release.yml skeleton"
Task T002: "Add Release Process section to README.md"

# Phase 2 — can verify in parallel:
Task T003: "Verify extension/package.json version and GH_PAT secret"
Task T004: "Confirm ci.yml and cd.yml have no tags trigger"

# Phase 6 — after T013, these can run concurrently:
Task T014: "Validate Scenario 2 (duplicate rejection)"
Task T015: "Validate Scenario 3 (tag-version mismatch)"
Task T016: "Validate Scenario 4 (password masking)"
Task T017: "Validate Scenario 5 (CD pipeline unaffected)"
Task T018: "Verify downloaded archive is password-protected"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003, T004)
3. Complete Phase 3: User Story 1 (T005, T006, T007)
4. **STOP and VALIDATE**: Push a tag, confirm version validation and duplicate guard work
5. The workflow exits after the guard steps (no archive, no release yet) — sufficient to prove US1

### Incremental Delivery

1. Setup + Foundational → workflow file exists, version source confirmed
2. Add US1 (version validation + duplicate guard) → push tag, verify gate behavior
3. Add US2 (CI gate + archive creation) → push tag, verify archive and secret
4. Add US3 (GitHub Release) → push tag, verify release page and asset
5. Polish (T013–T018) → comprehensive end-to-end validation

### Single-Developer Sequence

All tasks are sequential (single file) except T001/T002 and the Phase 6 validation tasks:

```
T001 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014–T018
        (T002 in parallel with T001)
```

---

## Notes

- [P] tasks touch different files OR are independent YAML blocks that can be drafted simultaneously
- All US1/US2/US3 tasks edit `.github/workflows/release.yml` sequentially — commit after each logical group
- The `VERSION` env var written in T006 is consumed by T011 and T012; these must be in order
- The `ARCHIVE` env var written in T011 is consumed by T012; T012 must follow T011
- `GH_PAT` must already exist in GitHub Secrets before T011 can succeed (verified in T003)
- No new source files are created — only `.github/workflows/release.yml` and `README.md` are modified/created
