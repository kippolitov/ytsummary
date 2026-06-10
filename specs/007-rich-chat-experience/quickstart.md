# Quickstart Validation Guide: Rich Chat Experience

**Feature**: `007-rich-chat-experience` | **Date**: 2026-06-10

This guide describes how to validate the feature end-to-end after implementation. It covers manual smoke tests and the automated test commands to run.

---

## Prerequisites

- Node.js 18+ installed
- Extension dev build running (`npm run dev` in `extension/`)
- Extension loaded as an unpacked extension in Chrome (`extension/.output/chrome-mv3-dev/`)
- Azure Function running locally or pointed at the deployed environment via `WXT_AZURE_FUNCTION_URL`

---

## Scenario 1: Rich Markdown Rendering (P1)

**Goal**: Confirm AI responses render formatted content instead of raw markdown symbols.

**Steps**:
1. Navigate to any YouTube video with captions (e.g., a tech tutorial or documentary)
2. Open the Chrome extension side panel
3. Switch to the **Chat** tab
4. Send the message: `Give me a detailed breakdown of the main topics covered in this video, using headings and bullet points`
5. Wait for the response to complete

**Expected**:
- Response renders with visible `##`-style headings as styled heading elements (not `##` symbols)
- Bullet points render as an HTML `<ul>` list
- Any `**bold**` text renders as bold
- No raw markdown symbols are visible in the output

---

## Scenario 2: Syntax-Highlighted Code Block

**Goal**: Confirm code blocks render with syntax highlighting.

**Steps**:
1. Navigate to a video about programming (e.g., a JavaScript tutorial)
2. Ask: `Can you show me an example of the code pattern discussed in this video?`
3. If the video has no code, ask: `Show me a pseudocode example that illustrates the main concept`

**Expected**:
- Code block renders with a distinct background and monospace font
- Syntax tokens are colorized (keywords, strings, comments in different colors)
- No raw backtick fencing visible

---

## Scenario 3: Callout Block Rendering

**Goal**: Confirm callout blocks render with visual emphasis.

**Steps**:
1. Ask: `What is the single most important takeaway from this video? Highlight it as a key insight`
2. Observe the response

**Expected**:
- The "Key Insight" section renders as a visually distinct callout — not as a plain blockquote
- The callout has a left border or background tint and a bold label
- The rest of the response renders normally

---

## Scenario 4: Table Rendering

**Goal**: Confirm tables render with clear structure.

**Steps**:
1. Ask: `Create a comparison table of the pros and cons discussed in this video`

**Expected**:
- Response renders an HTML `<table>` with header row and data rows
- Table is readable within the side panel width (~400 px)
- On narrow panel widths, table scrolls horizontally rather than overflowing

---

## Scenario 5: Follow-Up Prompt Chips (P2)

**Goal**: Confirm three follow-up chips appear after each response and submit on click.

**Steps**:
1. Send any question and wait for the full response
2. Observe below the response bubble

**Expected**:
- Three prompt chip buttons appear within 2 seconds of the response completing
- Each chip contains a short, relevant follow-up question ending with `?`
- Clicking a chip submits it as a new user message (appears in the chat as a user bubble)
- A new AI response begins loading immediately after

**Fallback test** (silent failure):
- Disconnect network after the main response, then check — follow-up chips should not appear and no error should be shown

---

## Scenario 6: Follow-Up Chips Reset on New Message

**Goal**: Confirm chips reset when the user sends a new message.

**Steps**:
1. Get an AI response so follow-up chips appear
2. Type a custom message in the input field and submit it

**Expected**:
- Follow-up chips disappear as soon as the new message is submitted
- New chips appear below the new AI response when it completes

---

## Scenario 7: Hyperlinks Open in New Tab

**Goal**: Confirm links in responses open externally.

**Steps**:
1. Ask: `Are there any web resources related to what was discussed?`
2. If no links appear naturally, check a response from a video that typically includes URLs

**Expected**:
- Clickable hyperlinks open in a new browser tab
- The YouTube page and side panel remain open

---

## Automated Test Commands

Run these from the `extension/` directory after implementation:

```bash
# Unit tests (covers ChatMessageBubble, FollowUpPromptChips, followUpClient)
npm run test

# Coverage report (must stay ≥ 80% on changed modules)
npm run test -- --coverage

# E2E tests (covers P1 chat flow and follow-up chip interaction)
npm run test:e2e
```

---

## Contracts Reference

- [Follow-Up Prompts API contract](./contracts/follow-up-prompts-api.md)
- [Data model](./data-model.md)

---

## Done When

- [ ] All 7 manual scenarios pass
- [ ] `npm run test` passes with ≥ 80% coverage on `ChatMessageBubble.tsx`, `FollowUpPromptChips.tsx`, `followUpClient.ts`
- [ ] No raw markdown symbols visible in any AI response
- [ ] Follow-up chips appear, reset, and submit correctly
