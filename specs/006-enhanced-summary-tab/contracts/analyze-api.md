# Contract: Analyze API — Enhanced Summary Tab Changes

**Feature**: `006-enhanced-summary-tab` | **Date**: 2026-06-09
**File modified**: `functions/src/models/index.ts`, `functions/src/services/openaiOrchestrator.ts`

---

## HTTP Request — unchanged

```
POST /api/analyze
Content-Type: application/json

{
  "videoId": "<11-char YouTube ID>",
  "title": "<string, max 500 chars>",
  "channelName": "<string, max 200 chars>",
  "transcript": "<string>",
  "durationSeconds": <number ≥ 0>
}
```

Validation: `isAnalyzeRequest()` in `functions/src/models/index.ts` — unchanged.

---

## HTTP Response — `summary` removed, `tldr` added

### Before

```json
{
  "videoId": "abc12345678",
  "summary": "This video explains dependency injection in .NET. The presenter walks through constructor injection and service registration. By the end, viewers can configure a DI container from scratch.",
  "topics": [
    { "name": "DI Container", "description": "How to register services.", "timestampSeconds": null }
  ],
  "steps": [],
  "references": [],
  "analyzedAt": "2026-06-09T10:00:00.000Z"
}
```

### After

```json
{
  "videoId": "abc12345678",
  "tldr": [
    "Dependency injection decouples object creation from usage, making code testable and maintainable.",
    "Constructor injection is the preferred DI pattern in .NET — dependencies are declared in the constructor signature.",
    "The built-in .NET DI container registers services via AddSingleton, AddScoped, and AddTransient.",
    "Service lifetimes (singleton vs scoped vs transient) determine how long instances are reused.",
    "The presenter builds a minimal console app DI container from scratch to illustrate each concept."
  ],
  "topics": [
    {
      "name": "DI Container Setup",
      "description": "The presenter configures a minimal IServiceCollection and builds an IServiceProvider. He explains that AddSingleton creates one instance for the app lifetime, AddScoped creates one per request, and AddTransient creates a new instance every call. This distinction is often confused by beginners and is the root cause of many subtle runtime bugs in ASP.NET Core apps.",
      "timestampSeconds": null
    }
  ],
  "steps": [],
  "references": [],
  "analyzedAt": "2026-06-09T10:00:00.000Z"
}
```

---

## OpenAI Prompt Schema — changed

### Before (in `buildPrompt()`)

```json
{
  "summary": "3-5 sentence plain-language overview of the video",
  "topics": [
    { "name": "Topic name", "description": "1-2 sentence description", "timestampSeconds": null }
  ],
  ...
}
```

### After

```json
{
  "tldr": [
    "First key takeaway as a single complete sentence",
    "Second key takeaway",
    "..."
  ],
  "topics": [
    {
      "name": "Specific, descriptive topic title (not 'Topic 1')",
      "description": "2-5 sentence contextual explanation. Include at least one specific insight, implication, or supporting detail not captured in the tldr bullets.",
      "timestampSeconds": null
    }
  ],
  ...
}
```

### Prompt rules added

```
- tldr: array of 3 to 7 bullet strings. Each bullet is one complete sentence conveying a distinct takeaway.
  No bullet may repeat or paraphrase another bullet.
- topics: extract major concepts in the order they appear in the video.
  Each description must be 2-5 sentences and include at least one insight not in the tldr.
  Use specific titles (e.g., "Gradient Descent Optimization") not generic labels (e.g., "Topic 3").
```

---

## `AnalyzeResponse` type — changed

### Before (`functions/src/models/index.ts`)

```typescript
export interface AnalyzeResponse {
  videoId: string;
  summary: string;
  topics: Topic[];
  steps: ImplementationStep[];
  references: Reference[];
  analyzedAt: string;
}
```

### After

```typescript
export interface AnalyzeResponse {
  videoId: string;
  tldr: string[];
  topics: Topic[];
  steps: ImplementationStep[];
  references: Reference[];
  analyzedAt: string;
}
```

---

## Parse logic — changed

### Before (`orchestrateAnalysis()`)

```typescript
return {
  videoId: req.videoId,
  summary: typeof parsed.summary === "string" ? parsed.summary : "",
  ...
};
```

### After

```typescript
const rawTldr = Array.isArray(parsed.tldr) ? parsed.tldr as string[] : [];
const tldr = rawTldr.filter((b): b is string => typeof b === "string").slice(0, 7);

return {
  videoId: req.videoId,
  tldr,
  ...
};
```

---

## Invariants (unchanged)

- `videoId` is a valid 11-character YouTube ID
- `analyzedAt` is an ISO 8601 timestamp
- `steps` is empty for non-tutorial content
- `references` is empty when no named tools/resources are mentioned
