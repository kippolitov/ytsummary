# Research: Enhanced Summary Tab — Knowledge Surface

**Feature**: `006-enhanced-summary-tab` | **Date**: 2026-06-09

## Decision 1: Replace `summary: string` with `tldr: string[]`

**Decision**: Remove the `summary: string` field from `AnalyzeResponse` (functions) and `AnalysisResult` (extension types) and replace it with `tldr: string[]` — an ordered array of 3–7 bullet strings.

**Rationale**: The current `summary` field is a prose paragraph. The spec requires a "scannable format of 3–7 concise bullet points" (FR-002). An array of strings maps directly to this: each element is one bullet, rendering is trivial, and the constraint (3–7 items) can be enforced at parse time in the orchestrator.

**Alternatives considered**:
- Keep `summary: string` and parse bullets from it client-side — rejected: fragile, shifts format responsibility to the extension, harder to test.
- Add `tldr: string[]` alongside `summary: string` — rejected: the existing `summary` paragraph would be rendered nowhere, becomes dead code (Constitution I: no dead code).
- Use a structured `{ text: string; weight: number }[]` type — rejected: over-engineered; the spec does not require priority weighting within TL;DR bullets.

---

## Decision 2: Enrich `Topic.description` via prompt change only — no new field

**Decision**: Keep `Topic.description: string` in both models. Change the OpenAI prompt to request "2–5 sentence contextual explanation including at least one insight or implication not captured in the TL;DR" instead of the current "1–2 sentence description".

**Rationale**: The spec requires topics to provide depth beyond the TL;DR (FR-005, FR-006). All required content (title, explanation, insight) fits naturally in a richer `description` string. Adding an `insight: string` field would duplicate intent and force the model to split content that belongs together in a coherent paragraph.

**Alternatives considered**:
- Add `insight: string` field alongside `description` — rejected: the spec does not require them to be visually separate; a unified explanation paragraph is cleaner and easier to render.
- Rename `description` to `explanation` — rejected: unnecessary breaking rename; semantics are conveyed through prompt instructions, not field names.

---

## Decision 3: Validate `tldr` array length at parse time in the orchestrator

**Decision**: After parsing the OpenAI JSON response, clamp the `tldr` array to [3, 7] elements: if fewer than 3 are returned, pass them through as-is (graceful degradation); if more than 7 are returned, truncate to 7.

**Rationale**: The model may occasionally over-generate or under-generate. Hard-failing on count mismatches would degrade UX (panel shows error instead of content). Clamping preserves the spirit of the spec while tolerating model variability. SC-001 ("under 30 seconds") applies to reading time, not strict count enforcement.

**Alternatives considered**:
- Throw an error if count is out of range — rejected: poor UX; a 9-bullet response is still useful.
- Re-prompt the model to fix the count — rejected: doubles latency and cost.

---

## Decision 4: Topic ordering — no new ordering logic needed

**Decision**: Topics are already returned by the model in order of appearance in the video. The prompt already instructs extraction in the order encountered. No client-side resorting is needed.

**Rationale**: FR-008 requires "ordered by sequence of appearance in the video (chronological order)". The current prompt says "extract major concepts covered" without ordering instruction — but the model naturally follows transcript order when given sequential input. A minor prompt clarification ("in the order they appear in the video") is sufficient; no sort key or `order: number` field is needed on `Topic`.

**Alternatives considered**:
- Add `order: number` to `Topic` — rejected: redundant; array index already encodes order.
- Sort client-side by `timestampSeconds` — rejected: `timestampSeconds` is frequently `null`, making reliable sort impossible.

---

## Decision 5: Token budget — existing `max_tokens: 2000` is sufficient

**Decision**: Keep `max_tokens: 2000` in the OpenAI completion call. No change needed.

**Rationale**: Worst-case output is approximately 7 TL;DR bullets × ~15 words + 10 topics × 5 sentences × ~20 words = ~105 + ~1000 words ≈ ~1400 tokens. The existing limit of 2000 tokens accommodates this with margin, even counting steps and references fields (which remain unchanged).

**Alternatives considered**:
- Increase to 3000 tokens — rejected: not needed; adds marginal cost with no benefit.
- Split into two calls (one for TL;DR, one for topics) — rejected: doubles latency and cost; violates SC-005 (3-second first-content display).
