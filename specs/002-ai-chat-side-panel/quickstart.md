# Quickstart Validation Guide: AI Chat Side Panel

**Feature**: 002-ai-chat-side-panel
**Date**: 2026-06-06

This guide describes how to validate that the feature works end-to-end after implementation. It covers environment setup, validation scenarios, and expected outcomes.

---

## Prerequisites

1. **Azure Function running locally** — follow the existing `functions/` devServer setup:
   ```
   cd functions && npm run dev
   ```
   The server starts at `http://localhost:7071`.

2. **Extension loaded in Chrome** — build and load in dev mode:
   ```
   cd extension && npm run dev
   ```
   Then open `chrome://extensions`, enable developer mode, and load the unpacked extension from `extension/.output/chrome-mv3/`.

3. **A YouTube video with captions** — navigate to any YouTube video that has auto-generated or manual captions available. The existing knowledge panel must load successfully (green "ready" state) before chat can be tested.

4. **Transcript cached** — confirm the summary panel has loaded for the current video (this triggers transcript caching). The chat tab is only functional once this step completes.

---

## Scenario 1: Ask a factual question (P1 — core Q&A)

**Validates**: FR-001, FR-002, FR-004, SC-001

**Steps**:
1. Open the side panel on a YouTube video where the knowledge panel has loaded.
2. Click the "Chat" tab.
3. Type a factual question about the video content (e.g., "What was the main conclusion of the video?").
4. Press Enter or click the Send button.

**Expected outcome**:
- A loading indicator appears within 300 ms.
- AI response text begins streaming within 15 seconds.
- The final answer accurately reflects content from the video transcript.
- The response does NOT fabricate information not present in the transcript.

---

## Scenario 2: Follow-up question (session context)

**Validates**: FR-003, SC-003

**Steps**:
1. Continuing from Scenario 1 (do not refresh or close the panel).
2. Type a follow-up question that references the previous answer (e.g., "Can you expand on that?").
3. Submit.

**Expected outcome**:
- The AI response acknowledges and builds on the previous answer.
- The conversation history is visible and ordered correctly in the chat view.

---

## Scenario 3: Close and reopen the panel (history persistence)

**Validates**: FR-003, SC-003

**Steps**:
1. With at least 2 completed Q&A turns in the chat, close the side panel.
2. Re-open the side panel via the extension toolbar icon.
3. Click the "Chat" tab.

**Expected outcome**:
- All prior messages are visible, in order, exactly as they were before the panel was closed.
- No duplicate or missing messages.

---

## Scenario 4: Generate a blog post

**Validates**: FR-006, FR-007 (copy), SC-002, SC-004

**Steps**:
1. Open the Chat tab (conversation may be empty or have prior messages).
2. Click the "Generate Blog Post" button.

**Expected outcome**:
- The AI begins streaming a blog post within 15 seconds.
- The final output contains: a title, an introduction, 2–5 sections with headings, and a conclusion.
- The blog post is rendered with markdown formatting (headings, paragraphs).
- Word count is approximately 600–1,200 words.
- A "Copy to Clipboard" button is visible on the blog post message.
- Clicking "Copy to Clipboard" copies the full plain-text or markdown content; a confirmation indicator is shown within 1 second.

---

## Scenario 5: Navigate to a new video

**Validates**: FR-009

**Steps**:
1. With chat history present for Video A, navigate to a different YouTube video (Video B).
2. Wait for the knowledge panel to load for Video B.
3. Open the Chat tab.

**Expected outcome**:
- The chat view is empty (no messages from Video A).
- The chat is ready to accept new input for Video B.
- If you then navigate back to Video A, the original chat history for Video A is restored from session storage.

---

## Scenario 6: No transcript available

**Validates**: FR-008

**Steps**:
1. Navigate to a YouTube video that has no captions (auto-generated or manual) and where the knowledge panel shows a "no transcript" or "error" state.
2. Open the Chat tab.

**Expected outcome**:
- The chat input is disabled or hidden.
- A clear plain-language message is displayed (e.g., "Chat is unavailable — this video has no transcript.").
- No error thrown or blank UI shown.

---

## Scenario 7: Service error during chat

**Validates**: FR-005

**Steps**:
1. Stop the local Azure Function dev server.
2. Attempt to send a chat message or generate a blog post.

**Expected outcome**:
- A plain-language error message appears within 2 seconds (e.g., "Could not reach the chat service. Check your connection and try again.").
- No raw error output or stack traces are visible.
- The user can retry after restarting the server.

---

## References

- API contract: [contracts/chat-api.md](contracts/chat-api.md)
- Data model: [data-model.md](data-model.md)
- Full plan: [plan.md](plan.md)
