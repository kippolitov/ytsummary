# Implementation Plan: Zip Contains Only Chrome Extension Folder

**Branch**: `005-zip-extension-only` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-zip-extension-only/spec.md`

## Summary

The current `release.yml` workflow creates a password-protected archive whose contents are the WXT-generated zip files (`extension/.output/*.zip`) — a zip-within-a-zip. Users must extract twice to reach the extension folder. This feature changes the archive creation step so the password-protected zip contains exactly the built Chrome extension folder (`extension/.output/chrome-mv3`) at its top level, and adds a content-validation step that fails the pipeline if any unexpected top-level entries appear.

## Technical Context

**Language/Version**: YAML (GitHub Actions workflow)

**Primary Dependencies**: `7za` (p7zip-full, pre-installed on `ubuntu-latest`), `gh` CLI (pre-installed), `openssl` (pre-installed)

**Storage**: GitHub Release assets (archive); GitHub Secrets (archive password)

**Testing**: Archive content validation via `7za l` listing inside the release workflow

**Target Platform**: GitHub Actions `ubuntu-latest` runner

**Project Type**: Browser extension (WXT/React monorepo) — release pipeline modification only

**Performance Goals**: No change from spec 004 (release workflow ≤ 5 minutes end-to-end)

**Constraints**:
- Archive top level MUST contain exactly `chrome-mv3/` and nothing else
- Password masking (`::add-mask::`) and secret storage behavior are unchanged
- `npm run zip` step is removed since WXT zip output is no longer needed

**Scale/Scope**: Targeted change to `.github/workflows/release.yml`; the `Zip extension` (`npm run zip`) step is removed and the archive creation step is updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|---|---|---|
| **QG-1 Code Quality**: linter passes with zero warnings | ✅ Addressed | Release workflow runs `npm run lint` before packaging; only file changed is the workflow YAML |
| **QG-2 Test Coverage**: CI reports ≥ 80% unit test coverage on changed modules | ✅ N/A | No new source modules; changed file is YAML only |
| **QG-3 UX Review**: loading indicators and error states consistent | ✅ N/A | No user-facing UI; pipeline surfaces clear error messages |
| **QG-4 Performance Benchmark**: p95 latency ≤ 30 s for 10-min video | ✅ N/A | Release pipeline change does not affect summarization latency |

No violations. No complexity exceptions needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-zip-extension-only/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── release-workflow.md   # Phase 1 output — updated archive step contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (all items ✅)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code Changes

```text
.github/
└── workflows/
    └── release.yml    # existing — steps modified
                       #   REMOVED: "Zip extension" step (npm run zip — no longer needed)
                       #   CHANGED: "Create password-protected archive"
                       #     old: 7za ... extension/.output/*.zip
                       #     new: (cd extension/.output && 7za ... chrome-mv3)
                       #   ADDED:   "Validate archive contents" step (7za list check)
```

**Structure Decision**: Single file change in `.github/workflows/release.yml`. No source code files are modified.
