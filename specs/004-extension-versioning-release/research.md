# Research: Extension Versioning and Secure Release Distribution

**Branch**: `004-extension-versioning-release` | **Date**: 2026-06-08

## 1. Authoritative Version Source

**Decision**: Use the `version` field in `extension/package.json` as the single authoritative version source.
**Rationale**: The file already exists at `extension/package.json` with `"version": "0.0.1"`, follows standard npm/Node.js conventions, and is already used by WXT when building the extension. Reading it in CI with `jq -r '.version' extension/package.json` is trivial and requires no extra tooling. The extension manifest version is then derived from this single source automatically by WXT during `wxt build`.
**Alternatives considered**:
- A separate `VERSION` file at the repo root — adds a second file to keep in sync; no advantage over `package.json`.
- Git tag as the version source (read `GITHUB_REF_NAME`) — separates the version from the code; mismatches between tag and `package.json` can occur silently.

---

## 2. Version Format

**Decision**: Semantic versioning `MAJOR.MINOR.PATCH` (e.g., `0.1.0`, `1.0.0`).
**Rationale**: Already the format used in `extension/package.json` (`"version": "0.0.1"`). Standard, widely understood, and supported natively by GitHub Releases tag conventions (`v0.1.0`).
**Alternatives considered**: Date-based versioning (`2026.06.08`) — less meaningful for users trying to understand backward-compatibility.

---

## 3. Release Trigger Strategy

**Decision**: Add a new `release.yml` workflow triggered on `push: tags` matching `v[0-9]+.[0-9]+.[0-9]+` (e.g., `v1.2.3`). Leave the existing `cd.yml` (push-to-main) unchanged.
**Rationale**: Releases should be explicit, intentional events tied to a version tag — not every main-branch merge. Separating the release workflow from `cd.yml` keeps each file's purpose clear: `cd.yml` handles continuous deployment of the Functions app on every merge; `release.yml` handles versioned extension releases only when explicitly tagged. This is the canonical GitHub Actions pattern for semantic releases.
**Alternatives considered**:
- Add a tag trigger to `cd.yml` — conflates two different lifecycle events in one file; harder to read and maintain.
- Trigger on `package.json` version change — not a supported GitHub Actions trigger; requires a polling workaround.

---

## 4. Tag-to-Version Consistency Enforcement

**Decision**: At the start of the release job, compare the pushed tag (stripped of `v` prefix) against the `version` field in `extension/package.json`. Fail the pipeline if they differ.
**Rationale**: Prevents releases where the git tag and the actual extension version are out of sync, which would create a GitHub Release labeled `v1.2.0` but containing an extension that identifies itself as `1.1.0`. This is a correctness check, not just a style check.
**Alternatives considered**:
- Read version exclusively from the git tag and patch `package.json` at build time — mutates source files during CI, which is brittle and harder to audit.
- Skip the check — allows silent mismatches; rejected.

---

## 5. Duplicate Release Detection

**Decision**: Before creating any artifact, run `gh release view "$TAG"` and fail with a clear error if the command succeeds (meaning the release already exists).
**Rationale**: `gh release view` exits non-zero when the release does not exist and exits zero when it does. This is idempotent, requires no external state, and catches duplicates before any work is done — satisfying FR-010. Failing early (before packaging) also means no orphaned artifacts are created.
**Alternatives considered**:
- Let `gh release create` fail on a duplicate — it would error, but after the packaging steps have already run; less clean.
- Use the GitHub API directly — `gh` CLI is already available on `ubuntu-latest` runners; no additional authentication needed.

---

## 6. Archive Naming Convention

**Decision**: Name the archive `ytsummary-v{version}.7z` (e.g., `ytsummary-v0.1.0.7z`).
**Rationale**: Includes the product name and the version number, making the file unambiguously identifiable when downloaded to a user's filesystem without needing to open it. The current CD uses `extension-${{ github.sha }}.7z` (commit SHA); the release archive uses the version number instead for human-readability.
**Alternatives considered**:
- `extension-v{version}.7z` — less distinctive; "extension" is too generic.
- `video-knowledge-panel-v{version}.7z` — the full `package.json` name; too long.

---

## 7. GitHub Release Creation Method

**Decision**: Use the `gh release create` CLI command (already available on `ubuntu-latest`) with the `--generate-notes` flag to auto-populate release notes from commits since the previous tag.
**Rationale**: `gh` CLI is pre-installed on GitHub-hosted runners. `--generate-notes` produces useful release notes automatically without requiring manual input or a separate changelog management tool. Asset upload is handled by passing the archive file path as a positional argument to `gh release create`.
**Alternatives considered**:
- `softprops/action-gh-release` Action — a third-party Action that adds a dependency; `gh` CLI achieves the same with no additional dependency.
- GitHub REST API via `curl` — more verbose; `gh` CLI is a cleaner wrapper.

---

## 8. Required Permissions and Token

**Decision**: The release job requires `permissions: contents: write` on the `GITHUB_TOKEN`. No additional PAT is needed for creating the release and uploading the asset. The `GH_PAT` (already used in `cd.yml` for `gh secret set`) is reused only for writing the password back to GitHub Secrets.
**Rationale**: `contents: write` is sufficient for `gh release create` and asset upload using `GITHUB_TOKEN`. The `GH_PAT` requirement comes from `gh secret set`, which needs `secrets:write` scope — this scope is not grantable to `GITHUB_TOKEN` by design (GitHub restriction).
**Alternatives considered**:
- Use only `GH_PAT` for all operations — workable but reduces auditability; better to use `GITHUB_TOKEN` where possible.

---

## 9. Password Generation (Release Archive)

**Decision**: Reuse the same pattern as `cd.yml`: generate per-release using `openssl rand`, mask immediately with `::add-mask::`, store to GitHub Secrets via `gh secret set EXTENSION_ZIP_PASSWORD`.
**Rationale**: Consistent with the existing approach (already validated in spec 003). The password is regenerated on each release, so old archives retain their original password (users who downloaded a previous release are unaffected). The latest password in the `EXTENSION_ZIP_PASSWORD` secret always corresponds to the most recent release.
**Clarification Q2 decision**: The password is shared with authorized users out-of-band (direct message or secure channel). It is never embedded in release notes, README, or any publicly visible location.

---

## 10. Existing CD Pipeline Disposition

**Decision**: Leave `cd.yml` unchanged. It continues to run on every main-branch push, producing a per-commit 7z artifact stored as a GitHub Actions artifact (transient, 30-day retention). The new `release.yml` workflow handles versioned GitHub Release creation on tag push.
**Rationale**: The CD artifact serves as a staging artifact for ad-hoc testing immediately after a merge; the release artifact is the canonical distributable. They serve different purposes and different audiences. The passwords are independent (both stored under `EXTENSION_ZIP_PASSWORD`, with the release job overwriting the CD job's value on the same run if both happen). To avoid ambiguity, the secret always reflects the most recently run job.
**Alternatives considered**:
- Remove the archive step from `cd.yml` — reduces redundancy but removes the staging artifact; the staging use case was intentionally designed in spec 003.

---

## 11. Secrets Summary (this feature)

| Secret Name | Purpose | Who Sets It | Change from 003? |
|---|---|---|---|
| `GH_PAT` | `gh secret set` scope — write password back to Secrets | Repo admin | No change |
| `EXTENSION_ZIP_PASSWORD` | Password for latest release 7z archive | Set by release pipeline | Overwritten on each release run |
