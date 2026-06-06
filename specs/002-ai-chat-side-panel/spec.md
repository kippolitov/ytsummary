# Feature Specification: AI Chat Side Panel

**Feature Branch**: `002-ai-chat-side-panel`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Let's extend this extension to add interactive chat and AI capabilities to the side panel. The AI chatbot should answer questions about the transcript, create a blog post about the video and dive deeper into the content discussed in the video."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask Questions About the Video (Priority: P1)

A user is watching a YouTube video and wants to ask specific questions about what was discussed — for example, "What was the main argument in the second half?" or "Did they mention any statistics?". They open the side panel, type their question into the chat input, and receive a contextually accurate answer drawn from the video transcript.

**Why this priority**: Direct Q&A is the core value proposition of an AI chat feature. It makes the transcript immediately useful without requiring the user to read the entire thing. Every other capability builds on this interaction model.

**Independent Test**: Open the side panel on any YouTube video with a transcript, type a factual question about its content, and verify the answer is accurate and grounded in the transcript.

**Acceptance Scenarios**:

1. **Given** the user is on a YouTube video page with a transcript and the side panel is open, **When** they type a question into the chat input and submit, **Then** a loading indicator appears and an AI-generated answer appears within 15 seconds.
2. **Given** the user has received an answer, **When** they ask a follow-up question that references the prior answer (e.g., "Tell me more about that"), **Then** the AI responds with context-aware continuity from the conversation history.
3. **Given** the user asks a question about something not mentioned in the video, **When** the AI responds, **Then** it clearly indicates the topic was not covered in the video rather than fabricating an answer.
4. **Given** the video has no available transcript, **When** the user opens the chat, **Then** the chat interface displays a clear message explaining that chat is unavailable without a transcript.

---

### User Story 2 - Generate a Blog Post (Priority: P2)

A user wants to repurpose a YouTube video into a publishable blog post. They open the side panel, click a "Generate Blog Post" button (or type a request), and receive a structured, well-written blog post based on the video's content — with a title, introduction, organized sections covering the main points, and a conclusion.

**Why this priority**: Blog post generation is a high-value, repeatable action that surfaces the chat feature's power without requiring the user to know what to ask. It drives immediate utility for content creators, researchers, and learners.

**Independent Test**: Click "Generate Blog Post" while on a YouTube video with a transcript and verify a complete, structured blog post is returned that accurately reflects the video's content and can be copied to the clipboard.

**Acceptance Scenarios**:

1. **Given** the user is on a video page with a transcript, **When** they click "Generate Blog Post" or type an equivalent request, **Then** a blog post is generated with a title, introduction, 2–5 content sections, and a conclusion.
2. **Given** the blog post has been generated, **When** the user clicks "Copy to Clipboard", **Then** the full blog post text is copied in a plain-text or markdown format.
3. **Given** the video is long (e.g., > 30 minutes), **When** the blog post is generated, **Then** it captures the key themes without exceeding a readable length (approximately 600–1,200 words).
4. **Given** generation fails due to a service error, **When** the error occurs, **Then** the user sees a plain-language error message with a suggestion to retry.

---

### User Story 3 - Deep Dive Into a Topic (Priority: P3)

A user hears a concept mentioned in the video they want to understand more deeply — for example, "explain transformer architecture in simpler terms" or "give me examples of what they said about pricing strategies". They ask the AI to expand on a topic, and the AI provides a more detailed explanation that combines what was said in the video with contextual elaboration.

**Why this priority**: Deep-dive responses increase the educational value of the feature. They depend on the P1 Q&A capability and are most valuable once the core chat loop works reliably.

**Independent Test**: Ask the AI to "explain [specific topic from the video] in more depth" and verify the response provides additional context beyond what was literally said in the transcript.

**Acceptance Scenarios**:

1. **Given** the user asks for a deeper explanation of a topic mentioned in the video, **When** the AI responds, **Then** the response goes beyond quoting the transcript and provides additional context or examples.
2. **Given** a topic is mentioned only briefly in the video, **When** the user asks for a deep dive, **Then** the AI acknowledges how much the video covered and supplements with relevant general knowledge, clearly distinguishing between the two sources.

---

### Edge Cases

- What happens if the user submits an empty or whitespace-only chat message?
- How does the system behave if the transcript is loaded after the user has already opened the chat?
- What happens if the user navigates to a different YouTube video while a chat response is loading?
- How does the chat handle extremely long transcripts that would exceed the AI model's context window?
- What if the user rapidly submits multiple messages before the first response arrives?
- What happens if the generated blog post response is truncated mid-generation due to a network timeout?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a chat input area within the side panel where users can type and submit questions or requests about the current video.
- **FR-002**: System MUST use the video's transcript as the primary knowledge source for all AI responses; the AI MUST NOT fabricate information not grounded in the transcript or general knowledge when asked for video-specific facts.
- **FR-003**: System MUST maintain conversation history within the current browser session so follow-up questions are understood in the context of prior messages.
- **FR-004**: System MUST display a progress indicator while an AI response is being generated for any request taking longer than 300 ms.
- **FR-005**: System MUST surface a plain-language error message with a suggested next action when AI generation fails for any reason.
- **FR-006**: System MUST provide a dedicated "Generate Blog Post" action (button or recognized chat command) that produces a structured blog post (title, introduction, sections, conclusion) from the video content.
- **FR-007**: System MUST allow users to copy AI-generated responses (including blog posts) to the clipboard with a single action.
- **FR-008**: System MUST clearly inform users when chat is unavailable due to a missing or inaccessible transcript.
- **FR-009**: System MUST clear chat history when the user navigates away from the video or when the browser session ends, consistent with the session-scoped caching strategy used in the existing knowledge panel.
- **FR-010**: System MUST handle deep-dive requests by providing elaboration that combines transcript evidence with relevant contextual explanation, clearly distinguishing video-sourced content from supplementary context where appropriate.

### Key Entities *(include if feature involves data)*

- **ChatMessage**: A single exchange unit with role (user or assistant), text content, and a timestamp. Carries metadata indicating whether it was generated as a blog post or a standard reply.
- **ChatSession**: The ordered collection of ChatMessages associated with a specific video (keyed by video ID). Scoped to the browser session.
- **BlogPost**: A structured document entity with title, introduction, an ordered list of content sections (each with a heading and body), and a conclusion. Produced by a dedicated generation action and presented as a chat assistant message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive an AI response to a chat question within 15 seconds of submission for a 10-minute video under standard network conditions (p95).
- **SC-002**: Generated blog posts are between 600 and 1,200 words and contain all required structural elements (title, introduction, sections, conclusion) in 100% of successful generations.
- **SC-003**: Chat conversation history is preserved across side panel open/close cycles within the same browser session, with 100% fidelity.
- **SC-004**: The chat interface remains interactive (accepts new input) during AI response generation — no blocking of the UI for longer than 300 ms.
- **SC-005**: Users can copy any AI-generated response to the clipboard in a single interaction, with confirmation feedback visible within 1 second.
- **SC-006**: Error states display a plain-language message and a recovery suggestion within 2 seconds of the failure occurring.

## Assumptions

- The existing transcript extraction mechanism from feature 001 (Video Knowledge Panel) will be reused directly as the knowledge source for the chat AI — no new transcript fetching is required.
- The existing Azure Function backend will be extended to handle chat and blog-post generation requests, rather than introducing a new service or endpoint; the same Azure OpenAI deployment will be used.
- Chat history is session-scoped only (lost on browser close or video navigation), consistent with the chrome.storage.session strategy already adopted in feature 001.
- The side panel layout will be extended to include a chat section below or alongside the existing knowledge panel; both views will be accessible without replacing each other.
- A single AI model deployment (e.g., gpt-4o-mini) is sufficient for all chat interactions including deep dives and blog post generation; no model upgrade is needed for v1.
- For videos with very long transcripts that exceed the model's context window, the system will use a summarized or chunked representation of the transcript rather than sending it in full — the exact strategy is a technical implementation detail resolved in the plan phase.
- Markdown rendering for AI responses (including blog posts) is assumed to be supported in the side panel UI.
- Multi-language transcript support is out of scope for v1; the AI will respond in the language of the transcript.
- The blog post is generated in a standard format without user-selectable templates or length options in v1.
