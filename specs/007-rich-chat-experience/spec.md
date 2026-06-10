# Feature Specification: Rich Chat Experience

**Feature Branch**: `007-rich-chat-experience`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "The Chat tab should be redesigned to provide a richer, more engaging, and easier-to-consume reading experience that transforms AI-generated conversations into highly structured, interactive content. Responses should support modern rich-text capabilities including headings, subheadings, emphasis, lists, tables, hyperlinks, block quotes, callouts, code blocks with syntax highlighting, inline code, and other formatting elements that improve readability and comprehension. The interface should intelligently organize long responses into visually distinct sections, making complex information easier to scan and navigate. Content should feel less like a plain text transcript and more like a polished knowledge article tailored to the user's needs. The experience should encourage exploration by highlighting key insights, actionable recommendations, and important takeaways through visual emphasis and contextual formatting. To further increase engagement and drive continued discovery, the Chat tab should generate three contextual follow-up prompts after each response. These prompts should be dynamically derived from the conversation and designed to help users uncover deeper insights, explore related topics, challenge assumptions, identify opportunities, or take meaningful next steps. Suggested prompts should be prominently displayed, easy to interact with, and written in a way that encourages curiosity and continued conversation. The overall experience should prioritize readability, visual hierarchy, discoverability, and user engagement while maintaining fast performance across desktop and mobile platforms."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Structured, Formatted AI Responses (Priority: P1)

A user asks a question in the Chat tab and receives a response that is visually organized rather than a wall of plain text. The answer may include a brief introduction, a bulleted list of key points, a table comparing options, bold callouts for critical takeaways, and block quotes where the video is cited directly. The user can immediately scan the structure, jump to the relevant section, and find the answer without reading every word.

**Why this priority**: Rich text rendering is the foundational change that all other improvements depend on. Without it, follow-up prompts and visual hierarchy have nothing to build on. It also delivers the most immediate, tangible readability improvement for every user in every session.

**Independent Test**: Open the Chat tab on a YouTube video, ask "What are the main points covered in this video?", and verify the response renders with at least one heading, one list, and one bold or emphasized element instead of flat plain text.

**Acceptance Scenarios**:

1. **Given** a user submits a question in the Chat tab, **When** the AI response is received, **Then** markdown formatting in the response (headings, lists, bold, tables, code, block quotes, callouts) is rendered visually — not shown as raw symbols.
2. **Given** a response contains a code example, **When** the response is displayed, **Then** the code block renders with syntax highlighting and a distinct background that sets it apart from prose.
3. **Given** a response contains a table, **When** the response is displayed, **Then** the table renders with clearly delineated rows and columns, readable on both the desktop side panel width and mobile screen widths.
4. **Given** the AI uses a callout or highlight block (e.g., a "Key Insight" or "Important" note), **When** the response renders, **Then** the callout is visually distinct from surrounding text through a colored border, background, or icon.
5. **Given** a response contains a hyperlink, **When** the user clicks it, **Then** it opens in a new tab and does not navigate away from the current YouTube page.

---

### User Story 2 - Explore the Conversation with Follow-Up Prompts (Priority: P2)

After each AI response, a user sees three suggested follow-up questions displayed beneath the reply. The prompts are relevant to what was just discussed — for example, after a summary, they might suggest "What evidence did the speaker give for this claim?", "How does this compare to the mainstream view?", or "What actionable steps can I take based on this?". The user clicks one and it is instantly submitted as their next message, continuing the conversation without typing.

**Why this priority**: Follow-up prompts directly drive continued engagement and help users who do not know what to ask next. They surface value from the video that users might otherwise miss and reduce the blank-input friction that causes chat sessions to end prematurely.

**Independent Test**: Send any question in the Chat tab and verify that three clickable follow-up prompt chips appear below the AI response. Click one and verify it is submitted as the next user message and a new response begins loading.

**Acceptance Scenarios**:

1. **Given** an AI response has been fully delivered, **When** the response finishes rendering, **Then** three follow-up prompt suggestions appear below the response within 2 seconds.
2. **Given** three follow-up prompts are displayed, **When** the user clicks any one of them, **Then** the prompt text is submitted as the user's next message and the input field reflects that submission.
3. **Given** the conversation has multiple turns, **When** a new AI response is delivered, **Then** the three follow-up prompts update to reflect the context of the latest exchange, not the original question.
4. **Given** the AI fails to generate follow-up prompts (e.g., service error), **When** the main response renders, **Then** the follow-up prompt area is hidden gracefully — no error message is shown to the user for this secondary feature.
5. **Given** the user is on a mobile-sized screen, **When** follow-up prompts are displayed, **Then** the prompt chips wrap or stack so all three are accessible without horizontal scrolling.

---

### User Story 3 - Scan and Navigate Long Responses (Priority: P3)

A user asks a complex question and receives a long, multi-section response — for example, a breakdown of a documentary's five key arguments. The response uses section headings, numbered lists, and callout boxes so the user can visually scan the structure, identify the section they care about most, and read selectively rather than linearly.

**Why this priority**: Visual hierarchy for long-form content dramatically reduces cognitive load for information-dense responses. It depends on P1 rendering being in place and complements it with intentional structural prompting of the AI.

**Independent Test**: Ask the Chat tab to "Give me a detailed breakdown of everything covered in this video" and verify the response uses headings to divide major sections and the overall structure is scannable within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a response is longer than approximately 300 words, **When** it renders, **Then** it uses at least two heading levels to divide the content into named sections.
2. **Given** a response includes an actionable recommendation, **When** it renders, **Then** the recommendation is visually emphasized — through bold text, a callout block, or a distinct list item — rather than buried in prose.
3. **Given** a response with multiple sections is displayed, **When** the user scrolls through it, **Then** headings remain visually prominent and section boundaries are clearly distinguishable at all scroll speeds.

---

### Edge Cases

- What happens when the AI returns a response with no markdown formatting at all (plain prose only)?
- How does the rich text renderer behave with malformed or partially-valid markdown?
- What if follow-up prompts are identical or nearly identical to each other due to a low-diversity AI output?
- How does syntax highlighting behave for an unrecognized or ambiguous code language?
- What happens to the follow-up prompt area when a response is still streaming/loading?
- How does the layout behave when a table is wider than the available panel width on a narrow screen?
- What if a response contains a hyperlink that points to a potentially unsafe URL?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render markdown formatting in all AI chat responses, including: headings (H1–H3), bold and italic emphasis, unordered and ordered lists, tables, hyperlinks, block quotes, callout/admonition blocks, fenced code blocks, and inline code spans.
- **FR-002**: Code blocks MUST render with syntax highlighting based on the declared language; unlabelled code blocks MUST display with a neutral monospace style.
- **FR-003**: Hyperlinks in responses MUST open in a new browser tab and MUST NOT cause navigation away from the YouTube page.
- **FR-004**: System MUST generate three contextual follow-up prompt suggestions for each AI response and display them as interactive chips or buttons below the response.
- **FR-005**: Follow-up prompts MUST be derived from the conversation context — they MUST reflect the topic and direction of the current exchange rather than being generic.
- **FR-006**: Clicking a follow-up prompt MUST submit it as the user's next chat message without requiring any additional interaction.
- **FR-007**: Follow-up prompts MUST update after every AI response to reflect the latest conversational context.
- **FR-008**: The AI system prompt MUST be updated to instruct the model to structure responses using appropriate markdown formatting, including headings for multi-section answers, callout blocks for key insights or warnings, tables for comparisons, and code blocks for any code or command examples.
- **FR-009**: Callout/admonition blocks MUST be visually distinct from surrounding content through a combination of a colored left border or background fill, an optional icon, and a bold label (e.g., "Key Insight", "Important", "Tip").
- **FR-010**: Tables in responses MUST reflow or scroll horizontally on narrow screens to prevent layout overflow.
- **FR-011**: The rich text renderer MUST handle malformed markdown gracefully — partial or invalid syntax MUST fall back to plain text rendering without crashing the chat interface.
- **FR-012**: Follow-up prompt generation failures MUST be handled silently — the main response MUST always display regardless of whether prompts could be generated.

### Key Entities

- **RichChatMessage**: An extension of the existing ChatMessage entity that includes a `renderedContent` representation of the AI response in formatted HTML or structured markup, alongside the raw markdown source.
- **FollowUpPrompts**: A set of exactly three prompt strings associated with a specific AI response, generated in context and displayed as interactive elements below that response.
- **CalloutBlock**: A visually distinct content region within a response, carrying a type label (e.g., "Key Insight", "Important", "Tip", "Warning") and body text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of AI chat responses render with one or more structural formatting elements (heading, list, table, callout, or code block) rather than flat plain text.
- **SC-002**: Follow-up prompts appear within 2 seconds of the main AI response completing in 95% of cases.
- **SC-003**: The chat interface remains fully interactive during response streaming; no input-blocking or layout jank occurs at any point during message rendering.
- **SC-004**: Users click a follow-up prompt in at least 25% of chat sessions, indicating the prompts are discoverable and compelling.
- **SC-005**: The chat tab loads and renders existing conversation history within 500 ms of opening the side panel.
- **SC-006**: Rich text rendering introduces no visual regression in error states or loading indicators defined by existing UX patterns.

## Assumptions

- The existing AI backend supports streaming responses and returns markdown-formatted text when instructed via a system prompt update; no backend architecture change is required beyond prompt engineering and a secondary follow-up-prompt generation call.
- Follow-up prompts are generated as a second, lightweight request to the same AI backend immediately after the main response completes; they are not bundled into the primary response stream to avoid increasing main response latency.
- The existing Chat tab UI is built with a component structure that allows the message renderer to be swapped from plain text to a markdown renderer without redesigning the overall layout.
- The side panel width on desktop (approximately 380–420 px) and full-width on mobile defines the responsive design target; no separate mobile app adaptation is required.
- Callout block syntax follows a widely-used convention (e.g., GitHub-flavored blockquote with bold label prefix) that the AI can reliably produce when prompted; a custom parser or plugin will interpret this into the rendered callout component.
- Hyperlink safety (checking for malicious URLs) is out of scope for v1; standard browser security (sandboxed new tabs) is considered sufficient.
- The three follow-up prompts are generated in English matching the response language; multi-language prompt generation is out of scope for v1.
- Conversation history persistence behavior (session-scoped, cleared on video navigation) remains unchanged from the existing implementation in feature 002.
