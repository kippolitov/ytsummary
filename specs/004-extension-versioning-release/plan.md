# Implementation Plan: Extension Versioning and Secure Release Distribution

**Branch**: `004-extension-versioning-release` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-extension-versioning-release/spec.md`

## Summary

Add semantic versioning to the browser extension and introduce a new `release.yml` GitHub Actions workflow, triggered on semver git tags (`v*.*.*`), that validates version consistency, runs the CI gate, packages the extension as a password-protected 7z archive named `ytsummary-v{version}.7z`, creates a GitHub Release, and attaches the archive as the sole release asset. The archive password is generated per-release, stored in the `EXTENSION_ZIP_PASSWORD` repository secret, and shared with authorized users out-of-band. The existing `cd.yml` pipeline is left unchanged.

## Technical Context

**Language/Version**: TypeScript `^5.5.2` (extension workspace); YAML (GitHub Actions workflow)

**Primary Dependencies**:
- Extension build: WXT `^0.19.0`, Vitest `^1.6.0`, ESLint `^8.57.0`
- Release pipeline: `gh` CLI (pre-installed on `ubuntu-latest`), `7za` (p7zip-full, pre-installed on `ubuntu-latest`), `openssl` (pre-installed), `jq` (pre-installed)
- GitHub Actions: `actions/checkout@v4`, `actions/setup-node@v4`

**Storage**: GitHub Secrets (`EXTENSION_ZIP_PASSWORD`, `GH_PAT`); GitHub Release assets (permanent archive storage)

**Testing**: Vitest (`npm test`) and ESLint (`npm run lint`) run as a CI gate inside the release workflow before packaging

**Target Platform**: GitHub Actions runners (`ubuntu-latest`); end users on macOS/Windows/Linux with a 7z-compatible tool

**Project Type**: Browser extension (WXT/React monorepo with Azure Functions backend)

**Performance Goals**: Release workflow completes within 5 minutes end-to-end (SC-002)

**Constraints**:
- Password MUST be masked with `::add-mask::` before any use in logs
- Archive MUST NOT be committed to the repository
- Tag MUST match `package.json` version exactly (pipeline enforces this)
- Duplicate version tags MUST be rejected before any artifact is created

**Scale/Scope**: One new workflow file (`.github/workflows/release.yml`); version bump to `extension/package.json` only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|---|---|---|
| **QG-1 Code Quality**: linter passes with zero warnings | ✅ Addressed | Release workflow runs `npm run lint` as a required step before packaging; failure aborts the release |
| **QG-2 Test Coverage**: CI reports ≥ 80% unit test coverage on changed modules | ✅ Addressed | Release workflow runs `npm test` as a required gate; only file added is a workflow YAML — no new source modules, no new coverage floor |
| **QG-3 UX Review**: loading indicators and error states consistent | N/A | No user-facing UI; pipeline log output surfaces clear, actionable error messages for each failure case |
| **QG-4 Performance Benchmark**: p95 latency ≤ 30 s for 10-min video | N/A | Release pipeline does not affect summarization latency |

## Project Structure

### Documentation (this feature)

```text
specs/004-extension-versioning-release/
├── plan.md                      # This file
├── research.md                  # Phase 0 output — all key decisions
├── data-model.md                # Phase 1 output — entity definitions
├── quickstart.md                # Phase 1 output — validation scenarios
├── checklists/
│   └── requirements.md          # Spec quality checklist (all items ✅)
├── contracts/
│   └── release-workflow.md      # Full release.yml schema and invariants
└── tasks.md                     # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code Changes

```text
.github/
└── workflows/
    ├── ci.yml         # existing — NO CHANGE
    ├── cd.yml         # existing — NO CHANGE
    └── release.yml    # NEW — tag-triggered release workflow

extension/
└── package.json       # existing — version field bumped by maintainer before each release
                       # current value: "0.0.1" (already MAJOR.MINOR.PATCH format)
```

**Structure Decision**: Single new workflow file added under `.github/workflows/`. The `extension/package.json` version field (`"0.0.1"`) is already in MAJOR.MINOR.PATCH format and requires no structural changes — only version bumps by maintainers as part of the release process.

## Complexity Tracking

No constitution violations. No complexity exceptions needed.
