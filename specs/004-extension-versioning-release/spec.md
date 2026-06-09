# Feature Specification: Extension Versioning and Secure Release Distribution

**Feature Branch**: `004-extension-versioning-release`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "I would like to have versioning of the extension. I would also like so that CD pipeline publishes extension as a password-protected archive in some distribution folder and saves it as a release in GH."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Version Stamping on Release (Priority: P1)

When a maintainer merges a change and triggers the release process, the extension package is automatically stamped with the correct version number so that every release is uniquely and traceably identified.

**Why this priority**: Without versioning, users cannot tell which extension build they are running, and maintainers cannot correlate bug reports to specific releases. This is the foundation that makes all other release stories meaningful.

**Independent Test**: Trigger the release pipeline on the main branch and confirm the packaged extension contains the expected version number in its manifest. Delivers a versioned artifact as a standalone MVP.

**Acceptance Scenarios**:

1. **Given** a commit is tagged with a version string (e.g., `v1.2.3`), **When** the CD pipeline runs, **Then** the packaged extension manifest reflects version `1.2.3`.
2. **Given** the pipeline completes successfully, **When** a maintainer inspects the produced artifact, **Then** the version is human-readable and follows the `MAJOR.MINOR.PATCH` format.
3. **Given** a version has already been published, **When** another run attempts to publish the same version tag, **Then** the pipeline fails with a clear error indicating the version already exists.

---

### User Story 2 - Password-Protected Archive in Distribution Folder (Priority: P2)

After a successful build, the CD pipeline packages the extension into a password-protected archive and stores it in the designated distribution location, so that only authorized users can access the extension binary.

**Why this priority**: The archive provides the distributable artifact users download. Password protection ensures the binary cannot be trivially extracted or tampered with by unauthorized parties before the user deliberately unlocks it.

**Independent Test**: Run the release pipeline and confirm a password-protected archive appears at the distribution location. Downloadable archive can be verified by attempting to open it with and without the correct password.

**Acceptance Scenarios**:

1. **Given** a successful extension build, **When** the CD pipeline runs, **Then** a password-protected archive is created containing the extension package.
2. **Given** the archive is created, **When** a user attempts to open it with the correct password, **Then** the extension files are fully accessible.
3. **Given** the archive is created, **When** a user attempts to open it without a password or with an incorrect password, **Then** access is denied and no files are extractable.
4. **Given** a release completes, **When** a maintainer checks the distribution folder, **Then** the archive is present with a filename that includes the version number.
5. **Given** a release completes, **When** a user navigates to the GitHub Releases page, **Then** the archive is available exclusively as a GitHub Release asset — no separate folder or file is committed to the repository.

---

### User Story 3 - GitHub Release Creation with Archive Attachment (Priority: P3)

The CD pipeline automatically creates a tagged GitHub Release for each versioned publication and attaches the password-protected archive as a release asset, so that users can discover and download the correct version directly from the repository.

**Why this priority**: GitHub Releases provide a standard, discoverable interface for versioned downloads. Attaching the archive here makes distribution canonical and eliminates the need to locate files manually.

**Independent Test**: After a pipeline run, navigate to the GitHub Releases page and confirm a new release entry exists with the correct version tag, release notes, and the archive attached as a downloadable asset.

**Acceptance Scenarios**:

1. **Given** the CD pipeline completes successfully, **When** a maintainer opens the GitHub Releases page, **Then** a new release entry exists tagged with the version number.
2. **Given** the release is created, **When** a user clicks the release, **Then** the password-protected archive is listed as a downloadable asset.
3. **Given** multiple releases exist, **When** a user browses releases, **Then** each release is uniquely identified by its version tag and sorted with the latest first.
4. **Given** a release is created, **When** the pipeline fails partway through, **Then** no partial or incomplete GitHub Release is left in a broken state (pipeline is atomic or performs cleanup).

---

### Edge Cases

- What happens when the version tag already exists in GitHub? Pipeline should fail fast with an informative error before producing any artifacts.
- How does the system handle a failed build before the archive is created? No distribution or GitHub Release is produced; the pipeline exits with a non-zero status.
- What happens if the GitHub API is unavailable during release creation? The pipeline fails and surfaces a clear error; no orphaned archives are silently left in the distribution folder without a corresponding release.
- What if the archive password is accidentally exposed in pipeline logs? The password MUST NOT appear in any log output (masked as a secret).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST have a single authoritative version source that drives all version references in the build and package.
- **FR-002**: The version MUST follow semantic versioning (`MAJOR.MINOR.PATCH`) and be human-readable.
- **FR-003**: The CD pipeline MUST automatically read the version from the authoritative source when producing a release artifact.
- **FR-004**: The CD pipeline MUST package the built extension into a single archive file protected with a password using strong encryption.
- **FR-005**: The archive filename MUST include the version number to allow unambiguous identification of which version is contained.
- **FR-006**: The archive password MUST be stored as a protected secret in the CI/CD environment and MUST NOT appear in any pipeline log output.
- **FR-007**: The CD pipeline MUST upload the password-protected archive exclusively as a GitHub Release asset — no archive file is committed to or stored within the repository itself.
- **FR-008**: The CD pipeline MUST create a GitHub Release tagged with the version number upon each successful release.
- **FR-009**: The GitHub Release MUST have the password-protected archive attached as a downloadable asset.
- **FR-010**: The pipeline MUST be idempotent with respect to version uniqueness — attempting to publish an already-released version MUST fail with a clear error.
- **FR-011**: The archive password MUST be shared with authorized users out-of-band (e.g., via direct message or a secure communication channel) and MUST NOT appear anywhere in the repository, release notes, or pipeline output.

### Key Entities

- **Extension Version**: A semantic version string (`MAJOR.MINOR.PATCH`) that uniquely identifies a release; stored in one authoritative file and propagated to the extension manifest and artifact filenames.
- **Release Archive**: A password-protected compressed file containing the packaged extension; named to include the version and stored in the distribution location.
- **GitHub Release**: A tagged release entry in the GitHub repository that links a version tag to release notes and the downloadable archive asset.
- **Archive Password**: A secret credential required to decrypt and access the release archive; stored in the CI/CD secrets store and never logged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every release artifact is uniquely versioned — zero releases exist without a `MAJOR.MINOR.PATCH` identifier in the artifact filename and extension manifest.
- **SC-002**: A password-protected archive is available at the distribution location within 5 minutes of a release tag being applied to the repository.
- **SC-003**: A corresponding GitHub Release with the archive attached is created automatically for 100% of successful release pipeline runs, with no manual steps required.
- **SC-004**: The archive is inaccessible without the correct password — an unauthorized extraction attempt yields no extension files.
- **SC-005**: Pipeline logs contain zero occurrences of the plaintext archive password across all runs.
- **SC-006**: A duplicate-version release attempt is rejected by the pipeline before any artifact is produced, with a clear error message identifying the conflict.

## Assumptions

- The extension is already built and packaged by the existing CD pipeline; this feature adds versioning and release distribution steps on top of the existing build.
- Semantic versioning (`MAJOR.MINOR.PATCH`) is the agreed version format; version bumps are triggered manually by applying a git tag or by editing the authoritative version file before tagging.
- The archive password does not rotate per release by default (a single shared password is used); rotation strategy can be addressed in a follow-on feature if needed.
- The GitHub repository already has Actions enabled and the necessary GitHub token permissions to create releases and upload assets.
- The existing CD pipeline (from spec `003-cicd-pipelines`) is the pipeline being extended; no new pipeline infrastructure is introduced.
- End users are assumed to be internal or semi-trusted (e.g., team members or beta testers) who will receive the password through a secure channel managed outside the pipeline.
