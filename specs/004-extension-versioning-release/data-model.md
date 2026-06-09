# Data Model: Extension Versioning and Secure Release Distribution

**Branch**: `004-extension-versioning-release` | **Date**: 2026-06-08

## Entities

### 1. Extension Version

The canonical version identifier for a release of the extension.

| Field | Type | Constraints | Source |
|---|---|---|---|
| `version` | string | MAJOR.MINOR.PATCH format; must match git tag | `extension/package.json` → `version` field |
| `tag` | string | `v{version}` format (e.g., `v0.1.0`) | Git tag pushed by maintainer |

**Validation rules**:
- `version` MUST match the regex `^\d+\.\d+\.\d+$`
- `tag` MUST equal `v{version}` (enforced by pipeline at runtime)
- A `version` MUST NOT already have a corresponding GitHub Release (duplicate guard)

**State transitions**:
```
[package.json edited] → [git tag applied] → [tag pushed] → [release pipeline triggered]
                                                              → [version validated]
                                                              → [duplicate check passed]
                                                              → [release created]
```

---

### 2. Release Archive

The password-protected compressed file distributed to authorized users.

| Field | Type | Constraints | Derivation |
|---|---|---|---|
| `filename` | string | `ytsummary-v{version}.7z` | Version from `extension/package.json` |
| `contents` | binary | WXT-produced extension zip, AES-256 encrypted | `npm run zip` + `7za` |
| `password` | secret | 8-char alphanumeric; masked in all logs | Generated via `openssl rand` at release time |
| `encryption` | enum | `AES-256` with header encryption (`-mhe=on`) | Fixed — 7za flag |

**Rules**:
- `filename` MUST include the version number
- `contents` MUST be inaccessible without the correct `password`
- `password` MUST NOT appear in pipeline logs, release notes, repository files, or commit history
- Archive is uploaded exclusively as a GitHub Release asset — never committed to the repository

---

### 3. GitHub Release

The versioned release entry in the GitHub repository.

| Field | Type | Constraints | Derivation |
|---|---|---|---|
| `tag` | string | `v{version}`; MUST be unique across all releases | Git tag from trigger |
| `title` | string | `v{version}` | Same as tag |
| `notes` | string | Auto-generated from commits since previous tag | `gh release create --generate-notes` |
| `assets` | array | Exactly one item: the Release Archive | Uploaded by pipeline |
| `draft` | bool | `false` | Released immediately |
| `prerelease` | bool | `false` (default; can be set manually if needed) | Default |

**Rules**:
- A GitHub Release with `tag` equal to the current version's tag MUST NOT already exist (pipeline fails if it does)
- `assets` MUST contain exactly the versioned 7z archive
- Release is published (non-draft) immediately upon pipeline success

---

### 4. Archive Password Secret

The CI/CD environment secret that holds the password for the most recently published archive.

| Field | Type | Constraints |
|---|---|---|
| `name` | string | `EXTENSION_ZIP_PASSWORD` (fixed) |
| `value` | secret | 8-char alphanumeric; updated on each release run |
| `scope` | string | Repository-level GitHub Secret |

**Rules**:
- Value is always the password for the **most recently published** release archive
- Previous release archives retain their original password (the secret is overwritten, not appended)
- Value MUST be retrieved out-of-band by authorized users; never exposed in-band

---

## Source File Changes

| File | Change Type | Description |
|---|---|---|
| `extension/package.json` | Minor edit | `version` field already exists at `0.0.1`; bumped by maintainer before tagging each release |
| `.github/workflows/release.yml` | New file | Tag-triggered release workflow (see contracts/) |
| `.github/workflows/cd.yml` | No change | Existing push-to-main workflow left intact |
