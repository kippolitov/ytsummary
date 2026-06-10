# Quickstart Validation Guide: Enhanced Summary Tab

**Feature**: `006-enhanced-summary-tab` | **Date**: 2026-06-09

## Prerequisites

- All implementation tasks complete (see `tasks.md`)
- Extension built: `cd extension && npm run build`
- Extension loaded unpacked in Chrome (Settings → Extensions → Load unpacked → select `extension/.output/chrome-mv3-v*`)
- Azure Function running locally: `cd functions && npm start` (or pointed at the deployed function via `WXT_AZURE_FUNCTION_URL`)

---

## Scenario 1: TL;DR renders as bullets, not a paragraph

**Purpose**: Confirm `SummarySection` renders the `tldr` array as a bullet list.

**Steps**:

1. Navigate to any YouTube video with captions (e.g., a tutorial or conference talk).
2. Open the extension side panel.
3. Wait for the summary tab to finish loading (spinner disappears).

**Expected outcome**:

- The first content section is labeled **"TL;DR"** (not "Summary").
- The section contains a bulleted list of 3–7 items.
- No paragraph-style single block of text appears in the TL;DR section.
- Each bullet is a complete, self-contained sentence.

---

## Scenario 2: Topics section contains enriched descriptions

**Purpose**: Confirm topic entries contain 2–5 sentences with insight depth.

**Steps**:

1. Same video as Scenario 1 (must have 2+ distinct topics).
2. Scroll past the TL;DR to the **Topics** section.
3. Read any topic entry.

**Expected outcome**:

- Each topic entry has a **specific, descriptive title** (not "Topic 1" or "Main Point").
- The body text is 2–5 sentences in length.
- At least one sentence in the topic body contains detail that does not appear in any TL;DR bullet.

---

## Scenario 3: TL;DR content does not duplicate topic body text

**Purpose**: Confirm TL;DR and Topics are complementary, not redundant (FR-006).

**Steps**:

1. Read all TL;DR bullets.
2. Read the first topic entry's description.

**Check**: Does the topic description contain at least one fact, implication, or supporting detail that is **not** paraphrased in any TL;DR bullet?

**Expected outcome**: YES — the topic entry adds depth not captured in the TL;DR.

---

## Scenario 4: Short video produces minimal topics, long video produces more

**Purpose**: Confirm FR-007 (topic count proportional to video length).

**Steps**:

1. Open the extension on a video under 15 minutes. Count topics: expected 2–4.
2. Open on a video 15–60 minutes. Count topics: expected 3–8.

**Expected outcome**: Topic count falls within the expected range for each video length.

---

## Scenario 5: Unit tests pass

**Purpose**: Confirm test coverage gate (Constitution QG-2).

```bash
cd extension && npm test
cd functions && npm test
```

**Expected outcome**:

- All tests pass.
- `SummarySection` tests confirm: empty `tldr` renders nothing; populated `tldr` renders a `<ul>` with one `<li>` per bullet.
- `openaiOrchestrator` tests confirm: response with `tldr` array is parsed correctly; `summary` field is no longer expected.

---

## Scenario 6: Regression — Steps and References still render

**Purpose**: Confirm the data-model change did not break other sections.

**Steps**:

1. Open the extension on a tutorial video that contains implementation steps and tool references.
2. Scroll to the **Steps** and **References** sections.

**Expected outcome**: Both sections still render correctly — unchanged by this feature.

---

## Scenario 7: Loading indicator appears within 3 seconds

**Purpose**: Confirm SC-005 (first content within 3 seconds).

**Steps**:

1. Navigate to a new YouTube video (not cached).
2. Immediately open the side panel and start a stopwatch.

**Expected outcome**: The loading spinner appears before 3 seconds have elapsed. The TL;DR section appears once analysis completes.
