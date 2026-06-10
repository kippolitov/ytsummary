# Feature Specification: Enhanced Summary Tab — Knowledge Surface

**Feature Branch**: `006-enhanced-summary-tab`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Transform the summary tab into a comprehensive knowledge surface that helps users quickly understand, navigate, and revisit video content. The page will feature a prominent TL;DR Summary section that provides a concise, high-signal overview of the video's key takeaways, enabling users to determine relevance within seconds. Complementing the summary, a Topics section will organize the major discussion areas covered throughout the video and provide deeper contextual information, explanations, insights, and supporting details that are not included in the high-level summary. Together, these sections should balance brevity and depth, allowing users to both rapidly consume the core message and explore the important concepts, themes, and discussions presented in the video without needing to watch the entire recording."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rapid Relevance Determination via TL;DR (Priority: P1)

A user opens the summary tab on a YouTube video they have not seen. Within seconds of the tab loading, they read the TL;DR Summary section — a concise set of high-signal bullet points at the top of the page — and decide whether the video is worth their time. They do not need to scroll, watch any portion of the video, or read anything beyond the TL;DR to make this decision.

**Why this priority**: This is the highest-value action the tab can support. If the TL;DR fails to deliver an accurate, scannable signal, users cannot trust the tab for any downstream purpose. All other sections are additive only after this baseline works.

**Independent Test**: Open the summary tab on any video; confirm the TL;DR section is the first visible content, contains 3–7 bullet points or ≤ 100 words of prose, and allows a reader to state the video's core message after reading it once.

**Acceptance Scenarios**:

1. **Given** the summary tab is open and analysis is complete, **When** the user views the page, **Then** the TL;DR Summary section appears at the top before any other content section.
2. **Given** a TL;DR section is displayed, **When** the user reads it, **Then** they can accurately identify the video's primary subject and at least two key takeaways without reading any other section.
3. **Given** a TL;DR section is displayed, **When** measured, **Then** the entire TL;DR is readable in under 30 seconds (≤ 7 bullet points or ≤ 100 words of prose).
4. **Given** a video with no substantive content (e.g., under 1 minute or captions unavailable), **When** the tab loads, **Then** the TL;DR section communicates that the video could not be summarized with a plain-language explanation.

---

### User Story 2 — Deep Topic Exploration (Priority: P2)

After reading the TL;DR, a user wants to understand one or more topics more deeply without watching the video. They scroll to the Topics section and find each major discussion area listed with a title, contextual explanation, relevant insights, and supporting details that go beyond what the TL;DR captured. The user reads only the topics that interest them and comes away with a substantive understanding of those areas.

**Why this priority**: The TL;DR alone can tell a user *whether* to care; the Topics section tells them *what they would learn* if they did watch. Together these two sections cover the full spectrum from quick scan to informed exploration. Topics depend on TL;DR being present and working (US1 first).

**Independent Test**: On a video with multiple distinct discussion areas, confirm the Topics section lists each major theme with a title and explanation that contains meaningful detail not present in the TL;DR — not a repetition of summary bullets.

**Acceptance Scenarios**:

1. **Given** the summary tab is loaded, **When** the user scrolls past the TL;DR, **Then** a Topics section appears listing at least 2 and at most 10 topic entries for a standard-length video (10–60 minutes).
2. **Given** the Topics section is visible, **When** the user reads a topic entry, **Then** the entry includes a clear topic title, a contextual explanation (2–5 sentences), and at least one insight or detail not present in the TL;DR section.
3. **Given** a topic entry, **When** it covers a concept that was briefly mentioned in the TL;DR, **Then** the Topics entry provides meaningfully expanded explanation — not a paraphrase of the TL;DR bullet.
4. **Given** a video that covers only one broad topic with no meaningful sub-divisions, **When** the tab loads, **Then** the Topics section either lists the sub-themes within that single topic or is omitted entirely if no meaningful divisions exist.

---

### User Story 3 — Revisiting Content After the Fact (Priority: P3)

A user who watched a video a week ago returns to the summary tab to recall a specific concept or topic discussed. By scanning the Topics section headings and the TL;DR, they locate the relevant area and re-read the contextual detail without replaying the video.

**Why this priority**: Valuable as a knowledge retrieval use case, but only after the core read-once experience (US1 and US2) is solid. Revisit value depends on topic titles being memorable and scannable.

**Independent Test**: After a simulated "time gap" (simply closing and re-opening the tab), confirm that scanning topic headings alone allows a user to locate a previously read concept within 60 seconds.

**Acceptance Scenarios**:

1. **Given** the user returns to a video they previously analyzed, **When** the tab reloads, **Then** the TL;DR and Topics section content is identical to what was shown on the first visit (consistent, deterministic output per video).
2. **Given** the Topics section is visible, **When** the user scans topic titles only (without reading body text), **Then** each title is specific enough to identify the distinct concept it covers (e.g., "Gradient Descent Optimization" not "Topic 3").
3. **Given** a user scanning topic headings, **When** they find the topic they are looking for, **Then** the associated body text provides enough detail for them to recall the concept without needing to watch the video.

---

### Edge Cases

- What is shown in the TL;DR when the video content is too vague or generic to yield distinct takeaways (e.g., a vlog with no structured content)?
- How does the Topics section behave for extremely short videos (under 2 minutes) where there is only one topic?
- What happens when analysis produces duplicate or near-duplicate topic entries?
- How is the tab displayed during the loading/generation period before analysis is complete?
- What does the user see if analysis completes but yields no meaningful topics (e.g., a silent video or a video with only background music)?
- How are topics ordered — by appearance in the video, by importance, or alphabetically?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The summary tab MUST display the TL;DR Summary section as the first visible content element on the page, before the Topics section and all other content.
- **FR-002**: The TL;DR section MUST present the video's key takeaways in a scannable format of 3–7 concise bullet points; total word count MUST NOT exceed 100 words.
- **FR-003**: Each TL;DR bullet point MUST represent a distinct, independently meaningful takeaway — no bullet may simply repeat or paraphrase another.
- **FR-004**: The Topics section MUST appear below the TL;DR and list the major discussion areas covered in the video, each as a named entry with a body explanation.
- **FR-005**: Each topic entry MUST contain: a specific, descriptive title (not "Topic 1" or generic labels); a contextual explanation of 2–5 sentences; and at least one insight, supporting detail, or implication not captured in the TL;DR.
- **FR-006**: Topic content MUST NOT duplicate TL;DR bullets verbatim — topics must expand, explain, or add context beyond what the TL;DR already states.
- **FR-007**: The number of topic entries MUST be proportional to video length and content diversity: 2–4 topics for videos under 15 minutes; 3–8 topics for videos 15–60 minutes; up to 10 topics for videos over 60 minutes.
- **FR-008**: Topics MUST be ordered by their sequence of appearance in the video (chronological order), not alphabetically or by arbitrary ranking.
- **FR-009**: The tab MUST display a progress indicator during analysis generation; the indicator MUST appear within 3 seconds of the tab opening and disappear only when content is ready.
- **FR-010**: When no transcript is available or analysis cannot be completed, both sections MUST display a plain-language explanation and a suggested next action rather than empty placeholders.
- **FR-011**: The TL;DR and Topics sections MUST be visually distinct from each other through consistent typographic or layout differentiation.
- **FR-012**: Analysis output (TL;DR bullets and topic entries) for a given video MUST be deterministic — re-opening the tab for the same video within the same session MUST produce identical content.

### Key Entities

- **KnowledgeSurface**: The redesigned summary tab, composed of a TL;DR section and a Topics section, representing the complete knowledge output for a video.
- **TLDRSummary**: The top-level, high-signal overview; contains 3–7 bullet points (≤ 100 words total) representing the video's core message and most important takeaways.
- **TLDRBullet**: A single distinct takeaway within the TL;DR — must be self-contained, non-redundant, and readable in isolation.
- **TopicsSection**: The collection of topic entries displayed below the TL;DR, ordered chronologically by appearance in the video.
- **TopicEntry**: A single discussion area entry; has a descriptive title and a 2–5 sentence explanation that adds depth and context beyond the TL;DR.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can determine whether a video is relevant to their current goal in under 30 seconds of reading the TL;DR alone, without scrolling.
- **SC-002**: At least 85% of TL;DR bullets are rated as distinct and non-redundant when reviewed against the full topic list.
- **SC-003**: Each topic entry contains at least one piece of information (insight, detail, implication) that does not appear in the TL;DR section.
- **SC-004**: Users can locate a previously-read topic by scanning headings alone in under 60 seconds when returning to the tab.
- **SC-005**: The summary tab displays its first content (TL;DR or progress indicator) within 3 seconds of opening on a standard connection.
- **SC-006**: Topic count is proportional to video length: short videos (< 15 min) produce 2–4 topics; standard videos (15–60 min) produce 3–8 topics; long videos (> 60 min) produce up to 10 topics.

## Assumptions

- The extension already fetches and processes video transcripts as part of the existing knowledge panel feature (spec 001); this feature redesigns the output rendering layer for the summary tab, not the analysis pipeline.
- Analysis is performed server-side or via a cloud function; the extension sends a request and receives structured output (TL;DR bullets + topic entries) — the AI model selection and prompt engineering are outside this spec's scope.
- The user is accessing the summary tab from the existing side panel introduced in spec 001 and improved in spec 002; no new entry point is introduced by this feature.
- English-language videos are the primary target; multi-language support remains deferred per the assumption in spec 001.
- The TL;DR and Topics are generated in a single analysis pass — not as two separate requests — to avoid latency doubling.
- Caching behavior defined in spec 001 (session-scoped, cleared on browser close) applies unchanged to this feature's output.
- Mobile browser environments remain out of scope per spec 001.
