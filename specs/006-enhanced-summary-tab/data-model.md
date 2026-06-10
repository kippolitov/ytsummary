# Data Model: Enhanced Summary Tab — Knowledge Surface

**Feature**: `006-enhanced-summary-tab` | **Date**: 2026-06-09

## Entities

### TLDRBullet

A single high-signal takeaway from the video. Modelled as a plain `string` — no wrapper type needed (see [research.md Decision 1](research.md)).

| Attribute | Type | Constraints |
|-----------|------|-------------|
| text | `string` | Non-empty; ≤ ~30 words per bullet recommended by prompt |

Array constraint: `tldr: string[]` contains 3–7 items. If fewer than 3 are returned by the model, they are passed through; if more than 7, truncated.

---

### Topic *(modified)*

A major discussion area covered in the video. The `Topic` entity is unchanged at the type level; only the content contract (prompt instruction) for `description` changes.

| Attribute | Type | Change |
|-----------|------|--------|
| name | `string` | Unchanged — specific, descriptive title |
| description | `string` | **Enriched**: 2–5 sentence contextual explanation, must include at least one insight not in TL;DR |
| timestampSeconds | `number \| null` | Unchanged |

---

### AnalyzeResponse *(backend — modified)*

The HTTP response body from the Azure Function `/analyze` endpoint.

| Field | Before | After |
|-------|--------|-------|
| `videoId` | `string` | Unchanged |
| `summary` | `string` | **Removed** |
| `tldr` | — | **Added**: `string[]` (3–7 bullet strings) |
| `topics` | `Topic[]` | Unchanged (description content enriched via prompt) |
| `steps` | `ImplementationStep[]` | Unchanged |
| `references` | `Reference[]` | Unchanged |
| `analyzedAt` | `string` | Unchanged |

---

### AnalysisResult *(extension — modified)*

The shape cached in `sessionCache` and passed to `KnowledgePanel`.

| Field | Before | After |
|-------|--------|-------|
| `videoId` | `string` | Unchanged |
| `summary` | `string` | **Removed** |
| `tldr` | — | **Added**: `string[]` |
| `topics` | `Topic[]` | Unchanged |
| `steps` | `ImplementationStep[]` | Unchanged |
| `references` | `Reference[]` | Unchanged |
| `analyzedAt` | `string` | Unchanged |

---

### KnowledgeSurface (UI)

The rendered summary tab. Composed of two primary sections displayed in fixed order.

| Section | Component | Source field |
|---------|-----------|--------------|
| TL;DR Summary | `SummarySection` | `AnalysisResult.tldr` |
| Topics | `TopicsSection` | `AnalysisResult.topics` |

Existing sections (Steps, References) remain below Topics in `KnowledgePanel` — unchanged.

---

## State Transitions

```text
AnalysisResult.tldr = []         ──→  SummarySection renders nothing (null guard)
AnalysisResult.tldr = [...]      ──→  SummarySection renders bullet list
AnalysisResult.topics = []       ──→  TopicsSection renders nothing (existing behaviour)
AnalysisResult.topics = [...]    ──→  TopicsSection renders enriched entries
```

---

## Field Lifecycle

```text
OpenAI JSON response
  { tldr: ["bullet1", ...], topics: [{name, description, ...}], ... }
          │                             │
          ▼                             ▼
orchestrateAnalysis()           orchestrateAnalysis()
  clamp tldr to [3,7] items       pass topics as-is
          │                             │
          └──────────┬──────────────────┘
                     ▼
           AnalyzeResponse (functions)
                     │
             HTTP response body
                     │
            AnalysisResult (extension)
                     │
         sessionCache.storeResult()
                     │
              KnowledgePanel
              ├── SummarySection (tldr)
              └── TopicsSection (topics)
```
