# Contract: Release Workflow — Archive Step Changes

**Feature**: `005-zip-extension-only` | **Date**: 2026-06-09
**File modified**: `.github/workflows/release.yml`

## Changes from spec 004 baseline

### Step removed: `Zip extension`

The following step is deleted in its entirety:

```yaml
- name: Zip extension
  env:
    WXT_AZURE_FUNCTION_URL: ${{ secrets.AZURE_FUNCTION_URL }}
    WXT_AZURE_FUNCTION_KEY: ${{ secrets.AZURE_FUNCTION_KEY }}
  run: npm run zip
  working-directory: extension
```

**Reason**: `npm run zip` produced WXT store-submission zips (`extension/.output/*.zip`) that were previously bundled inside the release archive. With the archive now targeting the built folder directly, this step produces unused artifacts.

---

### Step added: `Validate extension build output` (inserted before archive creation)

```yaml
- name: Validate extension build output
  run: |
    if [ ! -f extension/.output/chrome-mv3/manifest.json ]; then
      echo "ERROR: Chrome extension folder not found or missing manifest.json"
      exit 1
    fi
    echo "OK: extension/.output/chrome-mv3/manifest.json present"
```

**Purpose**: Provides an early, actionable failure if the build step produces no output or uses an unexpected path. Satisfies FR-004 and SC-003.

---

### Step modified: `Create password-protected archive`

**Before**:

```yaml
- name: Create password-protected archive
  env:
    GH_TOKEN: ${{ secrets.GH_PAT }}
  run: |
    PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8)
    echo "::add-mask::$PASSWORD"
    ARCHIVE="ytsummary-v${{ env.VERSION }}.zip"
    7za a -tzip -p"$PASSWORD" "$ARCHIVE" extension/.output/*.zip
    echo "ARCHIVE=$ARCHIVE" >> "$GITHUB_ENV"
    echo "ARCHIVE_PASSWORD=$PASSWORD" >> "$GITHUB_ENV"
    gh secret set EXTENSION_ZIP_PASSWORD -b "$PASSWORD" --repo "$GITHUB_REPOSITORY"
```

**After**:

```yaml
- name: Create password-protected archive
  env:
    GH_TOKEN: ${{ secrets.GH_PAT }}
  run: |
    PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8)
    echo "::add-mask::$PASSWORD"
    ARCHIVE="ytsummary-v${{ env.VERSION }}.zip"
    (cd extension/.output && 7za a -tzip -p"$PASSWORD" "../../$ARCHIVE" chrome-mv3)
    echo "ARCHIVE=$ARCHIVE" >> "$GITHUB_ENV"
    echo "ARCHIVE_PASSWORD=$PASSWORD" >> "$GITHUB_ENV"
    gh secret set EXTENSION_ZIP_PASSWORD -b "$PASSWORD" --repo "$GITHUB_REPOSITORY"
```

**Key change**: `extension/.output/*.zip` → `(cd extension/.output && 7za ... "../../$ARCHIVE" chrome-mv3)`

The subshell `cd` ensures 7za stores the path as `chrome-mv3/...` (no parent path segments) so the extracted archive contains exactly one top-level folder.

---

### Step added: `Validate archive contents` (inserted after archive creation)

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

**Purpose**: Automated post-creation content check. Satisfies FR-001, FR-002, SC-001, and SC-004.

---

## Invariants (unchanged from spec 004)

- Password is masked with `::add-mask::` before any use in run scripts
- Password is stored in `EXTENSION_ZIP_PASSWORD` GitHub Secret
- Archive is uploaded as a GitHub Release asset — never committed to the repository
- Duplicate version tags cause pipeline failure before any artifact is created

## Full step order after changes

1. `actions/checkout@v4`
2. `Validate version matches tag`
3. `Check for duplicate release`
4. `actions/setup-node@v4`
5. `Install dependencies`
6. `Lint`
7. `Unit tests`
8. `Verify required secrets`
9. `Build extension`
10. ~~`Zip extension`~~ *(removed)*
11. `Verify URL baked into zipped extension`
12. `Validate extension build output` *(new)*
13. `Create password-protected archive` *(modified)*
14. `Validate archive contents` *(new)*
15. `Create GitHub Release`
16. `Email archive password`
