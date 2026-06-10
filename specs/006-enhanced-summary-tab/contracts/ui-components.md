# Contract: UI Components — Enhanced Summary Tab

**Feature**: `006-enhanced-summary-tab` | **Date**: 2026-06-09
**Files modified**: `extension/components/sections/SummarySection.tsx`, `extension/components/KnowledgePanel/KnowledgePanel.tsx`

---

## SummarySection — props contract change

### Before

```typescript
interface SummarySectionProps {
  summary: string;
}
```

Rendered as a single `<p>` element.

### After

```typescript
interface SummarySectionProps {
  tldr: string[];
}
```

Rendered as a `<ul>` with one `<li>` per bullet. Returns `null` when `tldr` is empty.

### Rendering contract

| Input | Output |
|-------|--------|
| `tldr = []` | Returns `null` — nothing rendered |
| `tldr = ["bullet1"]` | Single `<li>` in a `<ul>` |
| `tldr = ["b1", "b2", ..., "b7"]` | Seven `<li>` elements |
| `tldr` with 8+ items | All items rendered (clamping done at API parse layer) |

### Accessibility

- The `<ul>` carries `aria-label="Key takeaways"` so screen readers announce the list purpose.
- Section heading text: `"TL;DR"` (matches constitution Principle III: stable vocabulary for "summary" concept).

---

## TopicsSection — no props change, rendering note

Props contract unchanged:

```typescript
interface TopicsSectionProps {
  topics: Topic[];
}
```

The `topic.description` field now contains richer content (2–5 sentences) vs. the prior 1–2 sentences. No rendering changes needed — the component already wraps description in a `<p>`. The visual result is naturally longer per entry.

---

## KnowledgePanel — props change

### Before

```typescript
// KnowledgePanel passes:
<SummarySection summary={result.summary} />
```

### After

```typescript
// KnowledgePanel passes:
<SummarySection tldr={result.tldr} />
```

All other section renders (`<TopicsSection>`, `<StepsSection>`, `<ReferencesSection>`) are unchanged.

---

## Visual hierarchy contract

The section display order in `KnowledgePanel` is unchanged:

1. Video header (title + channel) — optional
2. **TL;DR** (`SummarySection`) — first content section ← spec FR-001
3. Topics (`TopicsSection`)
4. Steps (`StepsSection`)
5. References (`ReferencesSection`)

---

## Loading and error states — unchanged

`App.tsx` renders `<LoadingIndicator />` during `status === "loading"` and `<ErrorMessage />` during `status === "error"`. Neither component references `summary` or `tldr` — no changes needed.
