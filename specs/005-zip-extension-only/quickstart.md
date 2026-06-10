# Quickstart Validation Guide: Zip Contains Only Chrome Extension Folder

**Feature**: `005-zip-extension-only` | **Date**: 2026-06-09

## Prerequisites

- The `release.yml` changes are applied (see [contracts/release-workflow.md](contracts/release-workflow.md))
- `7za` (p7zip-full) is installed locally
- A test build has produced `extension/.output/chrome-mv3/` (run `npm run build` inside `extension/`)

## Scenario 1: Validate archive structure locally (without running the full pipeline)

**Purpose**: Confirm that the 7za command produces the correct top-level structure before pushing.

**Steps**:

```bash
# 1. Build the extension locally
cd extension
npm run build
cd ..

# 2. Simulate the archive creation step
PASSWORD="testpass1"
ARCHIVE="ytsummary-test.zip"
(cd extension/.output && 7za a -tzip -p"$PASSWORD" "../../$ARCHIVE" chrome-mv3)

# 3. List archive contents (without extracting)
7za l "$ARCHIVE" -ba

# 4. Verify top-level entry
7za l "$ARCHIVE" -ba | awk '{print $NF}' | head -5
```

**Expected outcome**:
- All listed paths start with `chrome-mv3/`
- No paths at the root level (e.g., no `background.js` or other files alongside `chrome-mv3/`)
- Example listing:
  ```
  chrome-mv3
  chrome-mv3/manifest.json
  chrome-mv3/background.js
  chrome-mv3/sidepanel.html
  chrome-mv3/content-scripts/captionExtractor.js
  chrome-mv3/content-scripts/content.js
  chrome-mv3/assets/sidepanel-DUIeisNJ.css
  chrome-mv3/chunks/sidepanel-CQty4GRw.js
  ```

## Scenario 2: Validate extraction produces a directly-loadable extension

**Purpose**: Confirm a user can extract the archive and immediately load it in Chrome.

**Steps**:

```bash
# Using the archive created in Scenario 1
mkdir extracted
7za e -tzip -p"$PASSWORD" -o"extracted" "$ARCHIVE" -y

# Or to preserve folder structure (preferred):
7za x -tzip -p"$PASSWORD" -o"extracted" "$ARCHIVE" -y

ls extracted/
ls extracted/chrome-mv3/
```

**Expected outcome**:
- `extracted/` contains exactly one item: `chrome-mv3/`
- `extracted/chrome-mv3/manifest.json` exists
- Loading `extracted/chrome-mv3/` via Chrome → Extensions → Load unpacked succeeds without errors

## Scenario 3: Validate pipeline rejects archive with unexpected top-level files

**Purpose**: Confirm the `Validate archive contents` step catches contamination.

**Steps**:

```bash
# Create an archive with an extra file alongside chrome-mv3
7za a -tzip "bad-archive.zip" extension/.output/chrome-mv3 extension/.output/chrome-mv3.zip 2>/dev/null || true

# Run the validation logic
UNEXPECTED=$(7za l "bad-archive.zip" -ba | awk '{print $NF}' | grep -v '^chrome-mv3' | grep -v '^$' || true)
if [ -n "$UNEXPECTED" ]; then
  echo "PASS: Validation correctly rejected archive — unexpected entries:"
  echo "$UNEXPECTED"
else
  echo "FAIL: Validation did not catch unexpected entries"
fi
```

**Expected outcome**: Output contains `PASS: Validation correctly rejected archive`

## Scenario 4: Validate pipeline fails when extension folder is missing

**Purpose**: Confirm the `Validate extension build output` step catches a missing build.

**Steps**:

```bash
# Simulate missing build output
if [ ! -f extension/.output/chrome-mv3/manifest.json ]; then
  echo "PASS: Pipeline would fail — manifest.json not found"
else
  echo "To test: temporarily rename extension/.output/chrome-mv3/ and re-run"
fi
```

**Expected outcome**: Pipeline fails with `ERROR: Chrome extension folder not found or missing manifest.json` if the build step is skipped or fails.

## Full Pipeline Validation

Trigger the release pipeline (via `workflow_dispatch` on a test tag) and confirm:

1. The `Zip extension` step is absent from the pipeline log
2. The `Validate extension build output` step passes with `OK: extension/.output/chrome-mv3/manifest.json present`
3. The `Create password-protected archive` step completes without error
4. The `Validate archive contents` step passes with `OK: Archive contains only chrome-mv3`
5. The GitHub Release asset (`ytsummary-v*.zip`) extracts to exactly one folder: `chrome-mv3/`
