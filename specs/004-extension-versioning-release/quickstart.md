# Quickstart Validation Guide: Extension Versioning and Secure Release Distribution

**Branch**: `004-extension-versioning-release` | **Date**: 2026-06-08

## Prerequisites

- Write access to the GitHub repository
- `gh` CLI authenticated (`gh auth status`)
- `git` installed locally
- Access to GitHub repository Secrets (to verify `EXTENSION_ZIP_PASSWORD` is written)
- `7za` (p7zip) installed locally for archive verification

---

## Scenario 1: Successful Release (Happy Path)

**What it validates**: FR-001–009, SC-001, SC-002, SC-003, SC-004

### Setup

```bash
# 1. Ensure package.json version is set to the target release version
cd extension
cat package.json | grep '"version"'
# Expected: "version": "0.1.0"  (or whatever next version you're releasing)

# 2. Commit any pending changes
git add extension/package.json
git commit -m "chore: bump version to 0.1.0"
git push origin main   # or merge via PR first
```

### Trigger

```bash
# Apply and push the matching version tag
git tag v0.1.0
git push origin v0.1.0
```

### Expected outcomes

1. **Pipeline triggers**: A new `Release` workflow run appears under the repository's Actions tab, triggered by tag `v0.1.0`.
2. **Version validation passes**: Step "Validate version matches tag" completes without error.
3. **Duplicate guard passes**: Step "Check for duplicate release" completes without error (first time this tag is used).
4. **CI gate passes**: Lint, unit tests, and build all complete successfully.
5. **Archive created**: Step "Create password-protected archive" completes; `EXTENSION_ZIP_PASSWORD` secret is updated in repository settings.
6. **GitHub Release created**: Navigate to `https://github.com/{owner}/{repo}/releases` — a release tagged `v0.1.0` appears with:
   - Title: `v0.1.0`
   - Auto-generated release notes
   - Asset: `ytsummary-v0.1.0.7z`
7. **Archive is password-protected**: Download `ytsummary-v0.1.0.7z` and attempt extraction:
   ```bash
   # Should fail (no password):
   7za e ytsummary-v0.1.0.7z -o./test-no-pw
   # Expected: "Wrong password"
   
   # Should succeed (correct password retrieved out-of-band):
   7za e ytsummary-v0.1.0.7z -p"<correct-password>" -o./test-with-pw
   # Expected: extension zip extracted successfully
   ```

---

## Scenario 2: Duplicate Version Rejection

**What it validates**: FR-010, SC-006

### Steps

```bash
# Attempt to push the same tag again (simulate accidental duplicate)
git tag -d v0.1.0                  # delete local tag
git tag v0.1.0                     # re-create same tag
git push origin v0.1.0             # push it again (will fail at git level if remote exists)

# Or simulate by deleting the remote tag and re-pushing:
git push origin :v0.1.0            # delete remote tag
git push origin v0.1.0             # push again — release already exists in GitHub
```

### Expected outcome

- Pipeline triggers on the re-pushed tag.
- Step "Check for duplicate release" fails with: `ERROR: GitHub Release v0.1.0 already exists`
- Pipeline exits with a non-zero status before any archive is created.
- No new or overwritten GitHub Release is visible.

---

## Scenario 3: Tag-Version Mismatch Rejection

**What it validates**: FR-001, FR-002, FR-003 (consistency between version source and tag)

### Steps

```bash
# package.json has version "0.1.0"; push a tag with a different version
git tag v0.2.0
git push origin v0.2.0
```

### Expected outcome

- Pipeline triggers on tag `v0.2.0`.
- Step "Validate version matches tag" fails with: `ERROR: package.json version (0.1.0) does not match tag (0.2.0)`
- Pipeline exits with a non-zero status; no archive created, no release created.

---

## Scenario 4: Password Never Appears in Logs

**What it validates**: FR-006, SC-005

### Steps

1. After a successful release run, open the workflow run in GitHub Actions.
2. Expand the "Create password-protected archive" step.
3. Search the log output for any 8-character alphanumeric string that could be the password.

### Expected outcome

- Log shows `***` wherever the password would have appeared (GitHub's mask in action).
- No plaintext password is visible anywhere in the step logs.

---

## Scenario 5: Existing CD Pipeline Unaffected

**What it validates**: Regression — `cd.yml` still functions correctly after `release.yml` is added

### Steps

```bash
# Push a normal commit to main (not a tag push)
git push origin main
```

### Expected outcome

- Only `cd.yml` triggers (CI + Functions deploy).
- `release.yml` does NOT trigger (it only fires on version tags).
- The CD pipeline artifact (`extension-{sha}.7z`) is still uploaded as a GitHub Actions artifact as before.

---

## Artifact Reference

| Artifact | Location | Lifetime |
|---|---|---|
| `ytsummary-v{version}.7z` | GitHub Release assets page | Permanent (until manually deleted) |
| `extension-{sha}.7z` | GitHub Actions artifact (from `cd.yml`) | 30 days |
| `EXTENSION_ZIP_PASSWORD` | Repository Secrets | Overwritten on each release run |

See [data-model.md](data-model.md) for entity definitions and [contracts/release-workflow.md](contracts/release-workflow.md) for the full workflow schema.
