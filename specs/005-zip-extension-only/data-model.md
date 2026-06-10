# Data Model: Zip Contains Only Chrome Extension Folder

**Feature**: `005-zip-extension-only` | **Date**: 2026-06-09

## Entities

### Release Archive

The password-protected zip file attached to each GitHub Release.

| Attribute | Description |
|-----------|-------------|
| Filename | `ytsummary-v{MAJOR.MINOR.PATCH}.zip` |
| Encryption | AES-256 (7za `-tzip` with password) |
| Top-level contents | Exactly one entry: `chrome-mv3/` |
| `chrome-mv3/` contents | The complete built Chrome extension: `manifest.json`, `background.js`, `sidepanel.html`, `content-scripts/`, `chunks/`, `assets/` |
| Source | Built from `extension/.output/chrome-mv3/` by the `Build extension` step |

**Invariant**: The archive MUST contain exactly `chrome-mv3/` at the top level. Any other top-level entry is a pipeline error.

### Chrome Extension Folder

The built extension directory produced by `npm run build`.

| Attribute | Description |
|-----------|-------------|
| Location on runner | `extension/.output/chrome-mv3/` |
| Required files | `manifest.json` (presence confirms valid build), `background.js`, `sidepanel.html` |
| Optional subdirectories | `content-scripts/`, `chunks/`, `assets/` (WXT output structure) |
| Validity check | `manifest.json` must exist at `chrome-mv3/manifest.json` |

### Archive Password

| Attribute | Description |
|-----------|-------------|
| Generation | `openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8` (8 alphanumeric characters) |
| Masking | `::add-mask::$PASSWORD` before any use |
| Storage | GitHub Secret `EXTENSION_ZIP_PASSWORD` (overwritten each release) |
| Distribution | Out-of-band via email (`dawidd6/action-send-mail@v3`) — unchanged from spec 004 |

## State Transitions

```text
Build step completes
      │
      ▼
chrome-mv3/ exists with manifest.json  ──✗──▶  Pipeline fails: "Chrome extension folder not found"
      │
      ✓
      ▼
Archive created: ytsummary-vX.Y.Z.zip
(contains only chrome-mv3/ at top level)
      │
      ▼
Archive validated: 7za l shows only chrome-mv3  ──✗──▶  Pipeline fails: "Unexpected top-level entries"
      │
      ✓
      ▼
GitHub Release created with archive attached
```
