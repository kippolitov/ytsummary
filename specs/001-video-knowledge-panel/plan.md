# Implementation Plan: Video Knowledge Panel

**Branch**: `001-video-knowledge-panel` | **Date**: 2026-06-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-video-knowledge-panel/spec.md`

## Summary

Build a Chrome browser extension using WXT + React + TypeScript + Tailwind CSS that displays
a structured knowledge panel in a side panel alongside YouTube video pages. A content script
extracts video metadata and transcript from the YouTube page; the extension background service
worker sends this to an Azure Function that orchestrates Azure OpenAI to produce a summary,
topic list, implementation steps, and references. Results are cached in `chrome.storage.session`
for instant reload within a session.

## Technical Context

**Language/Version**: TypeScript 5.x (extension and Azure Function share the same language)

**Primary Dependencies**:
- Extension: WXT 0.19+, React 18, Tailwind CSS 3, Vite (via WXT)
- Backend: Azure Functions v4 Node.js 20 runtime, `@azure/openai` SDK, `@azure/functions` SDK

**Storage**: `chrome.storage.session` (MV3 session-scoped cache, cleared on browser close); no
persistent database in v1

**Testing**:
- Extension: Vitest (unit + integration), Playwright (end-to-end in Chrome)
- Azure Function: Vitest (unit), recorded HTTP fixtures via `nock` or `msw` for OpenAI integration

**Target Platform**: Google Chrome 120+ (Manifest V3); Azure Functions Node.js 20 LTS runtime on
Azure

**Project Type**: browser-extension + cloud-function (two sub-projects under one repository)

**Performance Goals**:
- Panel fully populated ≤ 30 s for a 10-minute video (p95)
- Side panel UI remains interactive (non-blocking) during analysis
- Azure OpenAI call target: ≤ 10 s (gpt-4o-mini, ~3,000 token input)

**Constraints**:
- Chrome MV3 Content Security Policy restricts `eval` and remote code execution in extension pages
- Azure Function API key stored in extension build-time environment variable (not user-visible)
- YouTube timedtext API accessible from content script (same-origin); must handle no-captions case
- Extension side panel memory ≤ 512 MB RSS (constitution QG-4)
- CORS on Azure Function must allow the extension's origin (`chrome-extension://<id>`)

**Scale/Scope**: Single-user extension (no multi-tenancy); one Azure Function endpoint; one
AI model deployment; session cache only (no cross-session persistence in v1)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|-------------|--------|-------|
| QG-1 Code Quality | ESLint + Prettier zero warnings; no unlinked TODOs | ✅ Pass | ESLint configured for both extension/ and functions/ sub-projects |
| QG-2 Test Coverage | ≥ 80% unit coverage on changed modules; integration tests use real fixtures, not hollow mocks | ✅ Pass | Vitest for both; OpenAI calls use recorded HTTP fixtures via msw |
| QG-3 UX Consistency | Loading indicator ≤ 3 s; plain-language errors; consistent terminology | ✅ Pass | Panel design enforces summary/topics/steps/references vocabulary; error component required |
| QG-4 Performance | p95 ≤ 30 s for 10-min video; ≤ 512 MB RSS | ✅ Pass | gpt-4o-mini target ~5–10 s; extension side panel is lightweight React app |

**Post-Phase 1 re-check**: All gates still pass after design. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-video-knowledge-panel/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── analyze-api.md   # Azure Function HTTP contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
extension/                        # WXT browser extension
├── entrypoints/
│   ├── background.ts             # MV3 service worker: routes messages, calls Azure Function
│   ├── content.ts                # YouTube page content script: extracts videoId + transcript
│   └── sidepanel/
│       ├── index.html
│       └── App.tsx               # React root: renders KnowledgePanel or loading/error state
├── components/
│   ├── KnowledgePanel/
│   │   └── KnowledgePanel.tsx    # Top-level panel layout
│   ├── sections/
│   │   ├── SummarySection.tsx
│   │   ├── TopicsSection.tsx
│   │   ├── StepsSection.tsx
│   │   └── ReferencesSection.tsx
│   └── shared/
│       ├── LoadingIndicator.tsx
│       └── ErrorMessage.tsx
├── services/
│   ├── transcriptExtractor.ts    # Parses YouTube timedtext XML into plain text
│   ├── analysisClient.ts         # Calls Azure Function endpoint
│   └── sessionCache.ts           # chrome.storage.session read/write helpers
├── types/
│   └── index.ts                  # Shared TypeScript interfaces (Video, KnowledgePanel, etc.)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── wxt.config.ts

functions/                        # Azure Functions app
├── src/
│   ├── analyze/
│   │   └── index.ts              # HTTP trigger handler (POST /api/analyze)
│   ├── models/
│   │   └── index.ts              # Request/response TypeScript interfaces
│   └── services/
│       └── openaiOrchestrator.ts # Builds prompt, calls Azure OpenAI, parses response
├── tests/
│   ├── unit/
│   └── integration/              # Uses msw to record/replay OpenAI HTTP responses
├── host.json
└── package.json
```

**Structure Decision**: Two sub-projects (`extension/` and `functions/`) under one monorepo root.
This matches the architecture: browser-side code and cloud-side AI processing are distinct
deployment targets with different runtimes, dependencies, and security boundaries. A shared
`types/` package is not introduced in v1 (each sub-project owns its own interfaces) to keep the
structure simple; types are duplicated minimally across the boundary.

## Complexity Tracking

> No constitution violations detected — this table is intentionally empty.
