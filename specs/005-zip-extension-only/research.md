# Research: Zip Contains Only Chrome Extension Folder

**Feature**: `005-zip-extension-only` | **Date**: 2026-06-09

## Decision 1: How to archive a folder at the top level using 7za

**Decision**: Use a subshell `cd` before invoking 7za so the archive path is relative to `.output/`, not the repository root.

```bash
(cd extension/.output && 7za a -tzip -p"$PASSWORD" "../../$ARCHIVE" chrome-mv3)
```

**Rationale**: When 7za is invoked as `7za a ... path/to/folder`, it stores the full relative path (`path/to/folder/file.txt`) in the archive. By changing to `extension/.output` first, the argument `chrome-mv3` is a bare name with no parent path segments, so the archive contains `chrome-mv3/file.txt` — a single top-level folder — which is the desired structure.

**Alternatives considered**:
- `zip -r -P "$PASSWORD" "$ARCHIVE" extension/.output/chrome-mv3` — native `zip` does not support AES encryption; the `-P` flag uses weaker ZipCrypto. Rejected: security concern.
- Wrapping in a shell script that temporarily changes directory — more complex, same effect as subshell. Rejected: unnecessary indirection.
- Using 7za's `-spf` flag (store full path) disabled — not a real flag; 7za has no built-in path-stripping option. Rejected: doesn't exist.

## Decision 2: Whether to keep the `npm run zip` step

**Decision**: Remove the `Zip extension` step entirely from `release.yml`.

**Rationale**: `npm run zip` is a WXT command that packages the extension into a zip for store submission (e.g., Chrome Web Store). It is not used for distribution in this project's release flow. The previous archive step (`7za ... extension/.output/*.zip`) consumed this output, but the new approach archives `chrome-mv3` directly from the build output. Removing the step reduces build time and eliminates an unused artifact.

**Alternatives considered**:
- Keep `npm run zip` and ignore its output — redundant work with no benefit. Rejected.
- Keep `npm run zip` for future store submission readiness — speculative; not part of any current spec. Rejected per constitution principle of no hypothetical scope.

## Decision 3: Archive content validation approach

**Decision**: Add a dedicated "Validate archive contents" step using `7za l` to list the archive and assert that no top-level entry other than `chrome-mv3` is present.

```bash
UNEXPECTED=$(7za l "$ARCHIVE" -ba | awk '{print $NF}' | grep -v '^chrome-mv3' | grep -v '^$')
if [ -n "$UNEXPECTED" ]; then
  echo "ERROR: Archive contains unexpected top-level entries:"
  echo "$UNEXPECTED"
  exit 1
fi
echo "OK: Archive contains only chrome-mv3"
```

**Rationale**: Satisfies FR-004 (pipeline fails if extension folder is absent/empty) and SC-003/SC-004 (100% automated validation on every run). The `7za l -ba` flag outputs only file entries (no headers), making it easy to parse with `awk` and `grep`.

**Alternatives considered**:
- Validate before creating the archive by checking `extension/.output/chrome-mv3/` exists and is non-empty — catches missing folder but not contamination inside the archive. Partial solution; used in addition (as a pre-check). Not sufficient alone.
- Trust the `cd && 7za` approach and skip validation — violates SC-004 ("automated validation on every run"). Rejected.

## Decision 4: Pre-check for extension folder existence

**Decision**: Add a guard before the archive creation step to confirm `extension/.output/chrome-mv3` exists and contains `manifest.json`.

```bash
if [ ! -f extension/.output/chrome-mv3/manifest.json ]; then
  echo "ERROR: Chrome extension folder not found or missing manifest.json"
  exit 1
fi
```

**Rationale**: Satisfies FR-004 and SC-003. Provides an early, clear failure with an actionable error message if the build step fails silently or produces an unexpected output path. `manifest.json` is a reliable signal that the folder is a valid Chrome extension.

**Alternatives considered**:
- Check only that the directory exists — does not confirm a valid extension build. Rejected for insufficient confidence.
- Let 7za fail naturally on a missing directory — produces a cryptic error. Rejected per constitution Principle III (plain-language errors).

## Summary of Changes to `release.yml`

| Step | Action | Reason |
|------|--------|--------|
| `Zip extension` | **Remove** | WXT zip output no longer used in archive |
| `Create password-protected archive` | **Modify** | Archive `chrome-mv3` folder instead of `*.zip` files |
| *(new)* `Validate archive contents` | **Add** | Automated post-creation content check (SC-004) |
| All other steps | **No change** | Build, lint, test, URL verification, release creation unchanged |
