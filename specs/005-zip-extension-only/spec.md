# Feature Specification: Zip Contains Only Chrome Extension Folder

**Feature Branch**: `005-zip-extension-only`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "I would like for the release artifact's password-protected zip file to only contain the folder of the chrome extension"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download and Install Extension from Release Archive (Priority: P1)

When a user downloads the release archive and extracts it with the correct password, the extracted content is exactly the Chrome extension folder — nothing more, nothing less — so the user can immediately load it into their browser without navigating through unrelated files.

**Why this priority**: The entire purpose of the archive is to deliver the extension to the end user. If the archive contains extra files (build artifacts, CI scripts, unrelated directories), users are confused about what to install and may incorrectly load the wrong folder. Ensuring the archive contains only the extension folder is the core correctness requirement.

**Independent Test**: Run the release pipeline, download the produced archive, extract it with the correct password, and verify the extracted content contains exactly one folder — the Chrome extension directory — with no extra files or folders alongside it. The extension folder must be directly loadable via the browser's "Load unpacked extension" dialog.

**Acceptance Scenarios**:

1. **Given** the CD pipeline produces a release archive, **When** a user extracts it with the correct password, **Then** the top-level content of the archive is exactly the Chrome extension folder and nothing else.
2. **Given** the archive is extracted, **When** a user opens the extracted folder, **Then** it contains only the Chrome extension files (e.g., `manifest.json` and related extension assets) with no extra scripts, logs, or build artifacts.
3. **Given** the archive is extracted, **When** a user attempts to load the extracted folder as an unpacked Chrome extension, **Then** the browser accepts it without errors related to missing or unexpected files.
4. **Given** the archive is created, **When** its contents are listed without extracting, **Then** the listing shows only the extension folder path (no extra top-level items).

---

### User Story 2 - Maintainer Validates Archive Contents Before Release (Priority: P2)

Before a release is published, a maintainer can verify that the archive contains only the Chrome extension folder, so that incorrect or contaminated archives are caught before users receive them.

**Why this priority**: Automated verification prevents regressions where unrelated files or build artifacts accidentally re-enter the archive due to pipeline changes, ensuring the release invariant is maintained over time.

**Independent Test**: Run the pipeline in a staging environment and inspect the archive manifest (without full extraction) to confirm the contents match the expected extension folder structure only.

**Acceptance Scenarios**:

1. **Given** a release archive has been produced, **When** the pipeline inspects its contents as part of the release job, **Then** the job passes only if the archive contains exactly the Chrome extension folder.
2. **Given** a pipeline change accidentally includes extra files in the archive, **When** the release job inspects the archive contents, **Then** the job fails with a clear message identifying the unexpected files.

---

### Edge Cases

- What happens if the Chrome extension build step produces no output folder? The archive creation step fails with a clear error and no archive is produced.
- What if the extension folder contains nested subdirectories (e.g., `icons/`, `js/`)? Those nested items are included as part of the extension folder — only top-level extra items outside the extension folder are excluded.
- What if the build process generates multiple output folders? The pipeline must be configured to target the single, authoritative Chrome extension output folder; any ambiguity must be resolved by explicit configuration, not heuristics.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The release archive MUST contain exactly one top-level entry: the Chrome extension folder.
- **FR-002**: No files or directories outside the Chrome extension folder MUST be present at the top level of the archive.
- **FR-003**: The contents of the Chrome extension folder within the archive MUST be identical to the output of the build step — no files are added or removed during the packaging process.
- **FR-004**: The pipeline MUST fail with a clear, actionable error if the extension folder is missing or empty at the time of archive creation.
- **FR-005**: The archive creation step MUST be configurable to target a specific, explicitly named extension output directory rather than inferring it from directory contents.
- **FR-006**: The archive's internal directory structure MUST preserve the extension folder as a named folder (not flatten its contents to the archive root), so the extracted folder is directly usable as an unpacked extension.

### Key Entities

- **Chrome Extension Folder**: The single output directory produced by the extension build step, containing `manifest.json` and all associated extension assets.
- **Release Archive**: The password-protected compressed file whose contents are restricted to exactly the Chrome extension folder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of release archives produced by the pipeline contain exactly one top-level entry (the extension folder) — zero archives include extraneous files or directories at the top level.
- **SC-002**: A user can extract the archive and load the resulting folder as an unpacked Chrome extension in under 60 seconds, without any additional file management steps.
- **SC-003**: The pipeline rejects archive creation in 100% of cases where the extension output folder is absent or empty, with an error message identifying the missing artifact.
- **SC-004**: Archive content validation (confirming only the extension folder is present) completes automatically as part of every release pipeline run with no manual steps required.

## Assumptions

- The Chrome extension build step produces a single, identifiable output folder whose name and location are known and consistent across runs.
- The existing release pipeline (from spec `004-extension-versioning-release`) is the pipeline being modified; the archive creation step within it is updated to scope its input to the extension folder only.
- No other distribution format (e.g., a `.crx` file or a flat zip without folder structure) is required by this feature; the existing password-protected zip format is retained.
- The extension folder structure (e.g., presence of `manifest.json` at its root) is stable and can be used as a validation signal.
