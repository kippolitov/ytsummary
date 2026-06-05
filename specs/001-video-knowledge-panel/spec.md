# Feature Specification: Video Knowledge Panel

**Feature Branch**: `001-video-knowledge-panel`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Build a browser extension that helps users consume long-form educational and technical video content more efficiently by transforming video transcripts into structured, actionable knowledge directly alongside the video."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Knowledge Panel (Priority: P1)

A user visits a YouTube video page. Without pressing play, the extension automatically detects the video, begins analyzing it, and within 30 seconds displays a structured knowledge panel alongside the player. The panel shows a concise summary, the major topics covered, key tools and resources mentioned, and any step-by-step procedures demonstrated. The user reads the panel and decides whether the content is worth watching.

**Why this priority**: This is the core value proposition — transforming a passive video visit into instant, structured knowledge extraction without requiring playback.

**Independent Test**: Navigate to any YouTube video with available captions; confirm the knowledge panel appears with populated sections within 30 seconds, without pressing play.

**Acceptance Scenarios**:

1. **Given** the extension is installed and the user navigates to a YouTube video page, **When** the page finishes loading, **Then** the knowledge panel activates automatically and a progress indicator appears within 3 seconds.
2. **Given** the panel has started loading, **When** analysis completes (within 30 seconds for a 10-minute video), **Then** the panel displays at minimum a Summary section, a Topics section, and any References found.
3. **Given** the panel is fully populated, **When** the user reads the Summary section, **Then** they can identify the video's primary subject and key takeaway without starting playback.

---

### User Story 2 - Viewing Decision Support (Priority: P2)

A user is evaluating multiple YouTube videos on the same topic. By scanning each video's knowledge panel — reading the summary, reviewing topics, and checking referenced tools — they rank the videos by relevance and choose which to watch in full, completing this triage in under 2 minutes per video.

**Why this priority**: Directly addresses the "should I watch this?" decision the feature is designed to accelerate; without this, the extension is only useful after a user has already committed to watching.

**Independent Test**: Visit 3 YouTube videos covering the same subject; confirm each panel independently provides enough information to rank them by relevance without watching any.

**Acceptance Scenarios**:

1. **Given** a user navigates from one YouTube video page to another, **When** the new page loads, **Then** the panel refreshes automatically with the new video's analysis, clearing the previous result.
2. **Given** a loaded panel, **When** the user reads the Topics section, **Then** all major subjects covered in the video are listed with enough context to assess their relevance to a specific learning goal.
3. **Given** a video that discusses specific tools or products, **When** the panel loads, **Then** a dedicated References section lists each named tool or product along with a brief description of how it was used in the video.

---

### User Story 3 - Implementation Step Extraction (Priority: P3)

A developer follows a technical tutorial on YouTube. Instead of pausing and rewinding to capture every step, they reference the knowledge panel's "Steps" section, which has already extracted and listed the procedures demonstrated in the video in order.

**Why this priority**: Eliminates the most friction-heavy part of learning from tutorials — manually transcribing steps — and enables offline or split-screen learning workflows.

**Independent Test**: Open a technical tutorial video (e.g., a coding walkthrough or configuration guide); confirm the panel's Steps section lists the demonstrated procedures in correct sequence.

**Acceptance Scenarios**:

1. **Given** a video containing a step-by-step demonstration, **When** the panel loads, **Then** a Steps section appears listing each procedure in the order it was presented, each as a self-contained, actionable instruction.
2. **Given** a video with no procedural content (e.g., a product overview or opinion piece), **When** the panel loads, **Then** the Steps section is omitted entirely rather than appearing empty.
3. **Given** the Steps section is populated, **When** the user reads any individual step, **Then** the step is understandable as a standalone action without needing to play the video.

---

### User Story 4 - Resource Discovery (Priority: P4)

After watching a conference talk, a user wants to find all tools, papers, and websites the speaker mentioned. The knowledge panel's References section has already captured every named resource, saving the user from replaying the video or searching the description.

**Why this priority**: Named resources in technical videos are high-value but easy to miss during playback and hard to reconstruct from memory; this section captures them passively.

**Independent Test**: On a video where the presenter explicitly names tools or links, confirm all mentioned resources appear in the References section with their usage context.

**Acceptance Scenarios**:

1. **Given** a video where the presenter names specific tools, libraries, papers, or websites, **When** the panel loads, **Then** a References section lists each named resource with a brief note on the context in which it was mentioned.
2. **Given** a reference entry in the panel, **When** the user interacts with it, **Then** if a URL is available the reference is navigable; if no URL is available the entry still shows the resource name and context.
3. **Given** a video that contains no external references, **When** the panel loads, **Then** the References section is omitted rather than displaying an empty list.

---

### Edge Cases

- What happens when a YouTube video has no auto-generated or manual captions?
- How does the panel behave on videos shorter than 1 minute or longer than 3 hours?
- What is shown when analysis fails due to a service or network error mid-generation?
- What happens on age-restricted, private, or members-only videos whose content cannot be accessed?
- How does the panel handle videos with mixed languages in the transcript?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST automatically activate on YouTube video pages without requiring the user to click or configure anything after installation.
- **FR-002**: The system MUST use the video's available transcript or captions as the source material for analysis.
- **FR-003**: The system MUST generate a concise summary (3–5 sentences) describing what the video covers and its primary takeaway.
- **FR-004**: The system MUST identify and list the major topics and concepts discussed in the video.
- **FR-005**: The system MUST extract step-by-step implementation procedures or demonstrations when present in the video content.
- **FR-006**: The system MUST identify tools, products, frameworks, libraries, papers, and external websites mentioned by the presenter.
- **FR-007**: The knowledge panel MUST be displayed alongside the video player without obscuring the video or disrupting the existing YouTube page layout.
- **FR-008**: The panel MUST display a progress indicator within 3 seconds of the video page loading while analysis is being generated.
- **FR-009**: The panel MUST update automatically when the user navigates to a different video, without requiring a page reload or manual refresh.
- **FR-010**: When no transcript is available, the extension MUST display a clear, plain-language explanation and suggest what the user can do (e.g., check if captions exist or try a different video).
- **FR-011**: When analysis fails due to a network or service error, the panel MUST display a user-friendly error message and a retry action.
- **FR-012**: The panel MUST be fully usable at the standard YouTube page width (1280px and above) without horizontal scrolling or layout breakage.
- **FR-013**: The extension MUST target Google Chrome as the sole supported browser at launch; Firefox and Edge support are deferred to future releases.
- **FR-014**: Analysis results MUST be cached for the duration of the browser session so that revisiting a previously-analyzed video within the same session loads the panel instantly; the cache MUST be cleared when the browser is closed.

### Key Entities

- **Video**: A YouTube video identified by its unique ID, title, and URL, with an associated transcript or caption data set.
- **KnowledgePanel**: The structured output rendered alongside the video, composed of one or more content sections depending on what was detected in the video.
- **Summary**: A short paragraph (3–5 sentences) capturing the video's core subject and primary takeaway.
- **Topic**: A named concept or subject area discussed in the video, with a brief description and an optional reference to when it appears.
- **ImplementationStep**: A discrete, ordered action extracted from a procedural or tutorial segment of the video, expressed as a self-contained instruction.
- **Reference**: A named tool, product, library, framework, paper, or website mentioned by the presenter, with a note on the context in which it appeared and a URL if one can be identified.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The knowledge panel is fully populated within 30 seconds of visiting a YouTube video page with available captions (baseline: 10-minute video).
- **SC-002**: 90% of users can determine whether a video is relevant to their current learning goal without starting video playback.
- **SC-003**: For tutorial and how-to videos, the panel correctly identifies and lists at least 85% of the implementation steps demonstrated in the video.
- **SC-004**: The panel is visible and fully functional on screens at 1280px width and above without requiring layout adjustments to the YouTube page.
- **SC-005**: Users find at least 80% of named tools and resources in the References section for technical videos where the presenter explicitly mentions them.
- **SC-006**: Users understand the no-transcript and error messages without needing additional explanation on first read.

## Assumptions

- YouTube auto-generated captions are available for the large majority of target content (technical tutorials, conference talks, product demonstrations); manual captions are treated as a bonus.
- The primary user is a developer, student, or technical professional who regularly watches instructional or educational YouTube content.
- The user is already signed into a browser where YouTube is accessible; the extension does not handle YouTube authentication.
- Mobile browser environments are out of scope for this version.
- The extension does not store, transmit, or retain personal user data beyond what is minimally necessary to generate the knowledge panel for the currently active video.
- Video content is primarily in English for the initial version; multi-language support is deferred to a future release.
- The extension does not interact with YouTube's playback controls, recommendation system, or ad serving infrastructure.
- Videos on YouTube.com are the only supported platform; other video hosting sites are out of scope.
