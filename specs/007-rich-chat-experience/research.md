# Research: Rich Chat Experience

**Feature**: `007-rich-chat-experience` | **Date**: 2026-06-10

All unknowns from the Technical Context are resolved below.

---

## Decision 1: Markdown Plugin Stack

**Question**: Which libraries extend `react-markdown` to cover tables, syntax highlighting, and callout blocks?

**Decision**: Use `remark-gfm` for GFM extensions (tables, strikethrough, task lists, autolinks) and `rehype-highlight` + `highlight.js` for syntax highlighting. Callout blocks use a custom React component registered under the `blockquote` renderer key — no extra plugin required.

**Rationale**:
- `remark-gfm` is the canonical companion to `react-markdown`; it is the first plugin listed in the react-markdown README and is peer-maintained by the same team.
- `rehype-highlight` wraps `highlight.js` and applies language detection and token classes at the rehype (HTML AST) level, which is the idiomatic approach with react-markdown's `rehypePlugins` API.
- `highlight.js` supports ~190 languages with tree-shakeable imports; using the `common` subset keeps the bundle small while covering JavaScript, TypeScript, Python, Bash, JSON, SQL, and other common languages seen in YouTube tech content.
- Custom callout rendering via `blockquote` component override requires zero additional dependencies — the AI's output is inspected at render time to detect callout syntax.

**Alternatives considered**:
- `react-syntax-highlighter`: Larger bundle (includes Prism and Highlight.js). Not needed since `rehype-highlight` + `highlight.js` is lighter and integrates directly at the rehype layer.
- `remark-directive` for callouts: Adds parsing complexity and requires the AI to output a non-standard `:::note` syntax reliably. Blockquote-based detection is simpler and degrades gracefully.
- `@shikijs/rehype` (Shiki): High quality but larger and requires async setup. Overkill for this panel scope.

---

## Decision 2: Callout Block Syntax Convention

**Question**: What markdown pattern should the AI use for callout blocks, and how should the renderer detect it?

**Decision**: Instruct the AI via system prompt to use GitHub-style blockquotes with a bold label on the first line:

```
> **Key Insight**: The main argument rests on three pillars.

> **Important**: This only applies to videos with captions enabled.

> **Tip**: You can ask follow-up questions to explore specific sections.

> **Warning**: Some statistics cited are from 2019 and may be outdated.
```

The `CalloutBlock.tsx` component receives the rendered `blockquote` children, inspects whether the first text node starts with a bold label matching a known set (`Key Insight`, `Important`, `Tip`, `Warning`, `Note`, `Example`), and if so renders a visually styled callout div with a left border, background tint, and icon. Non-matching blockquotes fall back to standard blockquote styling.

**Rationale**: The AI reliably produces bold inline text at the start of blockquotes when prompted. This syntax is already valid markdown and renders acceptably even without the custom component, providing a good fallback. Using a closed label set prevents the component from matching arbitrary bold sentences inside blockquotes.

**Alternatives considered**:
- `> [!NOTE]` GitHub Alerts syntax: Supported natively in GitHub Flavored Markdown and by `remark-github-alerts`. However, gpt-4o-mini does not reliably produce this syntax in streaming output unless the system prompt is very explicit. The `> **Label**:` form is more naturally produced by the model.
- Custom delimiter `:::note ... :::` (Docusaurus/remark-directive): Too unusual for the model to produce consistently.

---

## Decision 3: Follow-Up Prompts Generation Strategy

**Question**: Should follow-up prompts be bundled into the main response, returned in a separate streaming chunk, or fetched via a separate API call?

**Decision**: Separate non-streaming API call to `/api/chat` with `mode: "follow-up-prompts"`, fired after the main response stream completes. The call returns `application/json` with a `prompts: string[]` array (not SSE).

**Rationale**:
- Bundling into the main stream would require the AI to produce a structured JSON suffix at the end of a markdown response, which is error-prone to parse mid-stream and would add token overhead to every primary response.
- A separate call fires after the user already sees the full response, so its latency (typically < 1 second for a simple 3-item generation) is perceived as a fast secondary load rather than an extension of the primary wait time.
- Reusing `/api/chat` with a new mode avoids creating a new Azure Function and keeps the infrastructure surface minimal, consistent with the constitution's simplicity preference.
- The `follow-up-prompts` mode call is lightweight: the request payload is the conversation history (same as a regular chat request), and the response is a short JSON array of three strings.

**Alternatives considered**:
- New `/api/follow-up-prompts` endpoint: Creates a new Azure Function file for a feature that is essentially a chat-mode variant. Rejected in favor of the mode-based extension.
- Bundled JSON envelope in streaming response: Complex to parse mid-stream; risks corrupting markdown rendering if delimiter appears in the AI's prose. Rejected.
- Client-side prompt generation (no backend): Would expose the full transcript and conversation to a client-side AI call, adding complexity and security surface. Rejected.

---

## Decision 4: Follow-Up Prompt Storage

**Question**: Should generated follow-up prompts be stored with the chat session (persisted in `chatCache`) or derived ephemerally at runtime?

**Decision**: Follow-up prompts are ephemeral — stored only in React component state and not persisted to `chatCache`. They are only shown for the most recent assistant message in the current session.

**Rationale**:
- Follow-up prompts are contextually relevant only at the moment they are generated. When a user reopens a past chat session, the current message is already in the history and the user would naturally continue from the end, making old prompts stale and potentially confusing.
- Avoiding persistence keeps the `ChatSession` data model and `chatCache.ts` unchanged, reducing scope.
- If the user closes and reopens the panel mid-session, the follow-up prompts will be re-fetched via the normal flow when a new message is sent — there is no loss of functionality.

**Alternatives considered**:
- Persist prompts with `ChatMessage.followUpPrompts?: string[]`: Allows showing prompts on session reload. Rejected because stale prompts for old messages create a confusing UX and require a data model migration.

---

## Decision 5: Syntax Highlighting Theme

**Question**: Which highlight.js CSS theme should be used, and how should it integrate with the extension's dark mode?

**Decision**: Use `highlight.js/styles/github.css` for light mode and `highlight.js/styles/github-dark.css` for dark mode, imported conditionally based on the current theme class (`dark`) applied to the root element. The theme CSS is imported in `markdownComponents.ts` as a side-effect import so it is bundled by Vite and scoped to the extension.

**Rationale**: The GitHub themes are minimal, professional, and widely recognized. They are already visually consistent with the extension's existing GitHub-like prose styling from Tailwind. The `dark:` class-based theme switch matches the existing dark-mode pattern used throughout the extension.

**Alternatives considered**:
- Atom One Dark (universal dark): Does not adapt to light mode. Rejected.
- Inline CSS via `react-syntax-highlighter`: Heavier dependency. Rejected in favor of `rehype-highlight`.

---

## Summary: All Unknowns Resolved

| Unknown | Resolution |
|---------|------------|
| Markdown plugin stack | `remark-gfm` + `rehype-highlight` + `highlight.js` |
| Callout block syntax | `> **Label**: text` detected by custom `CalloutBlock.tsx` |
| Follow-up prompts generation | Separate `POST /api/chat` with `mode: "follow-up-prompts"` |
| Follow-up prompts persistence | Ephemeral in React state — not persisted to chatCache |
| Syntax highlighting theme | highlight.js GitHub themes (light/dark) |
