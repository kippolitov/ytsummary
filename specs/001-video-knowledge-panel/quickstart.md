# Quickstart: Video Knowledge Panel

**Purpose**: Validation guide — confirms the feature works end-to-end after implementation.
**Feature**: `001-video-knowledge-panel`
**Date**: 2026-06-05

---

## Prerequisites

- Google Chrome 120+ installed
- Node.js 20 LTS and npm 10+
- Azure subscription with an Azure OpenAI resource and a `gpt-4o-mini` deployment
- Azure Function App created (Node.js 20 runtime)
- Git repository cloned; on branch `001-video-knowledge-panel`

---

## Setup

### 1. Configure environment variables

**Extension** — create `extension/.env.local`:
```
WXT_AZURE_FUNCTION_URL=https://<your-function-app>.azurewebsites.net/api/analyze
WXT_AZURE_FUNCTION_KEY=<your-function-key>
```

**Azure Function** — create `functions/local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_OPENAI_ENDPOINT": "https://<your-openai-resource>.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "<your-api-key>",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o-mini"
  },
  "Host": {
    "CORS": "*"
  }
}
```

### 2. Install dependencies

```bash
cd extension && npm install
cd ../functions && npm install
```

### 3. Start the Azure Function locally

The project ships a lightweight local dev server (`functions/devServer.ts`) that wraps the
function handler directly — no Azure Functions Core Tools CLI required.

```bash
cd functions
npx tsx devServer.ts
# HTTP server starts on http://localhost:7071
```

Set `WXT_AZURE_FUNCTION_URL=http://localhost:7071/api/analyze` in `extension/.env.local` when
testing locally, or point to the deployed Azure URL for production testing.

### 4. Build and load the extension in Chrome

```bash
cd extension
npm run build
# WXT builds to extension/.output/chrome-mv3/
```

In Chrome:
1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. In the folder picker, press **Cmd + Shift + .** (macOS) to show hidden folders, then select
   `extension/.output/chrome-mv3/`
5. Note the extension ID shown — pin the extension to the toolbar for quick access

> **Reloading after a rebuild**: after running `npm run build`, go to `chrome://extensions` and
> click the **⟳** icon on the extension card to load the new output.

### 5. Open the side panel

Click the extension icon in the Chrome toolbar. The side panel opens automatically (this is
configured via `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in
`background.ts`). Navigate to any YouTube video — the panel activates automatically.

---

## Validation Scenarios

### Scenario 1: Panel activates and populates (P1 — core flow)

**Goal**: Verify the knowledge panel appears with all sections for a video with captions.

1. Click the extension icon in the toolbar to open the side panel (it will persist across tabs).
2. Navigate to any YouTube video that has captions (e.g., a recent conference talk or tutorial).
3. **Expected within 3 s**: The side panel shows a loading indicator.
4. **Expected within 30 s**: The panel displays all four sections — Summary, Topics, Steps (if
   applicable), References (if applicable).

**Pass criteria**: Panel is fully populated; no raw error text visible; summary is 3–5 sentences.

---

### Scenario 2: Navigation between videos refreshes panel (P2 — viewing decision)

**Goal**: Verify the panel resets and reloads when navigating to a different video.

1. After Scenario 1 completes, click on any other YouTube video from the sidebar or search.
2. **Expected**: Panel immediately shows loading indicator for the new video.
3. **Expected**: Panel populates with the new video's analysis within 30 s.

**Pass criteria**: Previous video's content is no longer visible; new content is distinct.

---

### Scenario 3: Session cache hit on revisit (FR-014)

**Goal**: Verify the panel reloads from cache instantly for a previously-analyzed video.

1. Copy the URL of the video from Scenario 1.
2. Navigate away (watch a second video).
3. Navigate back to the original URL.
4. **Expected**: Panel populates in < 1 s (no loading indicator flash beyond ~100 ms).

**Pass criteria**: No visible loading delay; panel content matches the original analysis.

---

### Scenario 4: No-transcript state (FR-010)

**Goal**: Verify the panel handles videos without available captions gracefully.

1. Find a YouTube video with no captions (newly uploaded, or a livestream without live captions).
2. Navigate to it.
3. **Expected**: Panel shows a plain-language message explaining captions are unavailable, with
   a suggested action (e.g., "This video doesn't have captions yet. Try a video with captions
   enabled.").

**Pass criteria**: No raw error code or stack trace visible; message is understandable on
first read (SC-006).

---

### Scenario 5: Error and retry (FR-011)

**Goal**: Verify the panel handles service errors with a retry option.

1. Stop the local Azure Function (`Ctrl+C` in the function terminal).
2. Navigate to a YouTube video with captions.
3. **Expected**: After ~45 s (timeout), or immediately if the function is unreachable, the panel
   shows a plain-language error message and a **Retry** button.
4. Restart the Azure Function: `npm run start` in `functions/`.
5. Click **Retry**.
6. **Expected**: Panel loads successfully.

**Pass criteria**: Error state shows message + retry action; retry succeeds when service is restored.

---

### Scenario 6: Steps section omitted for non-tutorial content (FR-005)

**Goal**: Verify the Steps section is omitted when the video has no procedural content.

1. Navigate to a YouTube video that is an opinion piece, interview, or product overview (not
   a step-by-step tutorial).
2. Wait for the panel to populate.
3. **Expected**: Panel renders Summary and Topics; Steps section is absent.

**Pass criteria**: No empty "Steps" heading is visible; other sections are present.

---

## Automated Test Commands

```bash
# Extension unit tests
cd extension && npm run test

# Extension unit test coverage report
cd extension && npm run coverage

# Azure Function unit tests
cd functions && npm run test

# Azure Function integration tests (requires recorded fixtures)
cd functions && npm run test:integration

# End-to-end tests (requires Chrome and extension loaded)
cd extension && npm run test:e2e
```

**Coverage gate**: `npm run coverage` MUST report ≥ 80% for all changed modules (Constitution
QG-2). CI will fail the build if coverage drops below this threshold.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Panel shows loading indefinitely | Azure Function not running or URL misconfigured | Check `WXT_AZURE_FUNCTION_URL` in `extension/.env.local`; ensure devServer or Azure Function is running |
| `401 Unauthorized` in DevTools | Missing or wrong function key | Check `WXT_AZURE_FUNCTION_KEY` in `.env.local`; confirm key is passed as `?code=` param not a header |
| CORS error in DevTools console | Extension origin not in Azure CORS allowlist | Run `az functionapp cors add --allowed-origins '*'`; verify `?code=` auth is used (custom headers trigger preflight auth failures) |
| "Load unpacked" folder not visible | `.output` is a hidden folder on macOS | In the folder picker, press **Cmd + Shift + .** to show hidden folders |
| Panel does not open on toolbar click | Side panel behaviour not registered | Reload the extension in `chrome://extensions`; `background.ts` calls `setPanelBehavior` on startup |
| "The video could not be analyzed" on a captioned video | Transcript extraction failed | Open DevTools on the YouTube tab → Console → look for `[CaptionExtractor]` logs to diagnose which step failed |
| `[CaptionExtractor] xml length: 0` in console | YouTube timedtext URL returns empty body | The `baseUrl` from `ytInitialPlayerResponse` may require specific request context; check the InnerTube fallback logs below it |
| Extension changes not reflected after rebuild | Old build still loaded | Go to `chrome://extensions` → click **⟳** on the extension card |
