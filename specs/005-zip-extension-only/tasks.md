# Tasks: Zip Contains Only Chrome Extension Folder

**Input**: Design documents from `/specs/005-zip-extension-only/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/release-workflow.md](contracts/release-workflow.md)

**Scope**: Single file change — `.github/workflows/release.yml`. No source code modified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2])

---

## Phase 1: Setup (Review Current State)

**Purpose**: Understand the exact current workflow structure before making changes.

- [x] T001 Read `.github/workflows/release.yml` and confirm the exact names of the three steps to change: `Zip extension`, `Create password-protected archive`, and verify `extension/.output/chrome-mv3/` is the correct build output path

---

## Phase 2: Foundational (Remove Redundant Step)

**Purpose**: Remove the `Zip extension` step — this is a prerequisite for both user stories and must complete before story work begins.

**⚠️ CRITICAL**: US1 and US2 both depend on this step being removed to avoid leftover `*.zip` globs being accidentally re-referenced.

- [x] T002 Delete the `Zip extension` step (the `npm run zip` step with `working-directory: extension`) from `.github/workflows/release.yml`

**Checkpoint**: `release.yml` no longer contains any reference to `npm run zip`.

---

## Phase 3: User Story 1 — Archive Contains Only Chrome Extension Folder (Priority: P1) 🎯 MVP

**Goal**: The password-protected release archive contains exactly the `chrome-mv3/` folder at its top level — no zip-within-a-zip, no extra files alongside the extension folder.

**Independent Test**: Build the extension locally (`cd extension && npm run build`), run the simulated archive command from [quickstart.md Scenario 1](quickstart.md), list archive contents with `7za l ytsummary-test.zip -ba`, and confirm every path starts with `chrome-mv3/`.

### Implementation for User Story 1

- [x] T003 [US1] Add a new `Validate extension build output` step in `.github/workflows/release.yml` immediately before the `Create password-protected archive` step, containing:
  ```yaml
  - name: Validate extension build output
    run: |
      if [ ! -f extension/.output/chrome-mv3/manifest.json ]; then
        echo "ERROR: Chrome extension folder not found or missing manifest.json"
        exit 1
      fi
      echo "OK: extension/.output/chrome-mv3/manifest.json present"
  ```

- [x] T004 [US1] Update the archive creation command in the `Create password-protected archive` step in `.github/workflows/release.yml`, changing the `7za` line from:
  ```
  7za a -tzip -p"$PASSWORD" "$ARCHIVE" extension/.output/*.zip
  ```
  to:
  ```
  (cd extension/.output && 7za a -tzip -p"$PASSWORD" "../../$ARCHIVE" chrome-mv3)
  ```
  All other lines in the step (password generation, masking, `$GITHUB_ENV` exports, `gh secret set`) remain unchanged.

**Checkpoint**: After T003 and T004, the archive contains only `chrome-mv3/` at the top level. Verify locally using Scenario 1 in [quickstart.md](quickstart.md).

---

## Phase 4: User Story 2 — Maintainer Validates Archive Contents Before Release (Priority: P2)

**Goal**: The pipeline automatically verifies that no unexpected top-level entries were included in the archive, failing fast with a clear error if contamination is detected.

**Independent Test**: Run Scenario 3 from [quickstart.md](quickstart.md) locally — create a bad archive with an extra top-level file, then run the validation command and confirm it outputs `PASS: Validation correctly rejected archive`.

### Implementation for User Story 2

- [x] T005 [US2] Add a new `Validate archive contents` step in `.github/workflows/release.yml` immediately after the `Create password-protected archive` step, containing:
  ```yaml
  - name: Validate archive contents
    run: |
      UNEXPECTED=$(7za l "${{ env.ARCHIVE }}" -ba | awk '{print $NF}' | grep -v '^chrome-mv3' | grep -v '^$' || true)
      if [ -n "$UNEXPECTED" ]; then
        echo "ERROR: Archive contains unexpected top-level entries:"
        echo "$UNEXPECTED"
        exit 1
      fi
      echo "OK: Archive contains only chrome-mv3"
  ```

**Checkpoint**: After T005, the pipeline self-validates its own output on every release run. Verify using Scenario 3 in [quickstart.md](quickstart.md).

---

## Phase 5: Polish & Verification

**Purpose**: Confirm the complete step order, run all quickstart scenarios, and ensure no dangling references remain.

- [x] T006 Verify the final step order in `.github/workflows/release.yml` matches the contract spec in [contracts/release-workflow.md](contracts/release-workflow.md): `Zip extension` is absent; `Validate extension build output` precedes `Create password-protected archive`; `Validate archive contents` follows it
- [x] T007 Run Scenario 1 from [quickstart.md](quickstart.md) locally to confirm the archive lists only `chrome-mv3` paths before pushing
- [x] T008 Run Scenario 2 from [quickstart.md](quickstart.md) locally to confirm extracted archive loads as an unpacked Chrome extension without errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — removes the `Zip extension` step; blocks US1 and US2 work
- **US1 (Phase 3)**: Depends on Phase 2 — T003 and T004 can run in parallel (different insertions in the same file, non-conflicting)
- **US2 (Phase 4)**: Depends on Phase 3 (T004 must be merged first so `${{ env.ARCHIVE }}` is defined before the validation step)
- **Polish (Phase 5)**: Depends on Phases 3 and 4

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependency on US2
- **User Story 2 (P2)**: Depends on US1 being complete (the `${{ env.ARCHIVE }}` env var is set by the modified archive step)

### Within Each User Story

- T003 and T004 are both edits to `release.yml` but in different locations (before vs. inside the archive step) — they can be done in either order within Phase 3
- T005 is a separate insertion after the archive step — safe to apply after T003/T004

---

## Parallel Example: User Story 1

```
# T003 and T004 target different locations in release.yml — apply in sequence to avoid conflicts:
T003: Insert "Validate extension build output" step before archive creation
T004: Modify 7za command inside "Create password-protected archive" step
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Review current `release.yml`
2. Complete Phase 2: Remove `Zip extension` step
3. Complete Phase 3: Add pre-check + modify archive command
4. **STOP and VALIDATE**: Run Scenario 1 from quickstart.md
5. Proceed to US2 once US1 is confirmed

### Incremental Delivery

1. T001 → T002 → T003 → T004: Archive now contains `chrome-mv3/` folder — US1 complete
2. T005: Pipeline self-validates archive contents — US2 complete
3. T006–T008: Polish and confirm

---

## Notes

- All tasks modify a single file: `.github/workflows/release.yml`
- No source code changes; no new dependencies
- T003 and T004 should be applied carefully to preserve surrounding YAML indentation
- The `${{ env.ARCHIVE }}` reference in T005 relies on the env var exported in the modified T004 step — do not reorder these steps
- Verify locally with quickstart.md before triggering a real release tag
