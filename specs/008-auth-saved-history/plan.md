# Implementation Plan: Sign-In and Saved History

**Branch**: `008-auth-saved-history` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-auth-saved-history/spec.md`

## Summary

Gate every extension feature behind Google sign-in, restricted to a developer-managed allowlist, and let signed-in users explicitly persist a video's summary and chat history so it survives indefinitely and syncs across devices. The client obtains a real Google ID token via `chrome.identity.launchWebAuthFlow()` (not `getAuthToken()`, which only yields an opaque access token — see research.md §1) and sends it as a bearer token on every backend call. A shared `withAuth` middleware on the Azure Functions side verifies the token's signature/claims via `google-auth-library` and checks the account against a new `AllowedUsers` Azure Table before any OpenAI call runs, rejecting with 403 otherwise. A new `SavedVideos` Azure Table (same storage account, no new resource group), partitioned by the user's Google `sub`, backs four new endpoints (list/get/save-or-update/delete) that the extension's existing summary/chat UI reads and writes through a new client service with the same shape as today's session-cache interfaces — only the backing store changes. Unsaved videos keep behaving exactly as today (`chrome.storage.session`). A local, non-public CLI script manages the `AllowedUsers` table so the developer can add/remove access without a new release or redeploy. Per the 2026-07-06 clarification session, saved chat history is capped at the existing 50-message limit (FR-008a), a single account may hold at most 200 saved videos (FR-019, enforced server-side on create), a signed-in session is expected to survive up to 30 days via silent token renewal before requiring interactive re-authentication (FR-006a), and concurrent multi-device writes resolve via unconditional last-write-wins (FR-020, no ETag/optimistic-concurrency check).

## Technical Context

**Language/Version**: TypeScript 5.5 (extension + functions)

**Primary Dependencies**:
- Extension: React 18.3, WXT (Vite-based extension builder), existing Tailwind CSS 3.4 UI kit; no new UI framework. `chrome.identity` is a browser API, not an npm package.
- Functions: Azure Functions v4 (`@azure/functions`), Node 18/20. New: `google-auth-library` (ID token verification against Google's JWKS), `@azure/data-tables` (Azure Table Storage client).

**Storage**: Two new Azure Tables (`AllowedUsers`, `SavedVideos`) in the existing Function App's storage account (same account as `AzureWebJobsStorage` — no new resource). `chrome.storage.session` remains, unchanged, for unsaved/active working state (FR-009). `chrome.storage.local` added on the client to persist the signed-in user's ID token + expiry across browser restarts (needed for "remain signed in" — spec.md US1 scenario 4).

**Testing**: Vitest 1.6 (unit, both extension and functions) + @testing-library/react 16 (extension unit) + Playwright 1.44 (extension E2E) + Azurite (Azure Storage emulator) for Table Storage integration tests, per the constitution's "no hollow mocks" rule for external API interactions.

**Target Platform**: Chrome extension (Manifest v3) side panel (client) + Azure Functions Node backend (server), same as all prior features in this codebase.

**Project Type**: Chrome extension (frontend React) + Azure Functions (Node backend) — matches the existing two-project layout.

**Performance Goals**: Auth verification adds negligible latency to existing endpoints — local JWT signature check (`google-auth-library` caches Google's JWKS in-process) plus one Table Storage point read (`AllowedUsers`) per request, both on the order of single-digit-to-low-double-digit milliseconds, well within the existing ≤30s p95 summary-latency budget (Constitution Principle IV). Saved-videos list/get calls target sub-second response for typical saved-video counts (tens, not thousands).

**Constraints**: No new Azure resource group or storage account (explicit instruction — reuse the existing one); no public/HTTP-exposed admin endpoint for managing `AllowedUsers` (CLI only); Azure Table Storage's 64 KiB per-string-property / ~1 MiB per-entity limits bound how saved chat history is stored (research.md §5); existing session-only behavior for unsaved videos must be bit-for-bit unchanged (FR-009); saved chat history capped at 50 messages (FR-008a) and saved videos capped at 200 per account, enforced server-side with a `409` response when a new save would exceed it (FR-019, research.md §8); no version/ETag check on saved-video writes — last write always wins (FR-020).

**Scale/Scope**: Single-user-per-sign-in extension; no concurrent-load concern beyond normal per-user request rates; `AllowedUsers` expected to stay small (an invitation list, not a public user base).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Check | Status |
|------|-------|--------|
| **QG-1 Code Quality** | No dead code; meaningful names; single responsibility; linter zero warnings | ✅ Auth verification (`services/auth.ts`), allowlist storage (`services/allowedUsersStore.ts`), and saved-video storage (`services/savedVideosStore.ts`) are separate, single-purpose modules; existing `analyze`/`chat` handlers gain one `withAuth(...)` wrap each, no duplicated auth logic |
| **QG-2 Test Coverage** | ≥ 80% unit coverage on changed modules; integration tests cover external API interactions with real stubs/fixtures, not hand-rolled mocks | ✅ Unit tests for `withAuth` (valid/expired/malformed/unauthorized-account cases), `savedVideosStore` chunking logic, `savedVideosClient.ts`; integration tests run `SavedVideos`/`AllowedUsers` CRUD against Azurite (a real emulator, not a mock) and Google ID-token verification against recorded, real-shaped JWT fixtures signed with a test key served from a stubbed JWKS response |
| **QG-3 UX Review** | Loading indicators for > 300 ms ops; no silent frozen UI; plain-language errors | ✅ Sign-in prompt and invitation-only message are explicit UI states (FR-004); Save action and Saved-view list/restore show loading indicators consistent with existing `LoadingIndicator` patterns; failed saves surface a plain-language, non-blocking error (FR-018), including the 200-saved-video-cap message (FR-019) |
| **QG-4 Performance** | p95 summary latency ≤ 30 s; memory ≤ 512 MB; no regression ≥ 20% | ✅ Auth check adds low-single-digit-ms local verification plus one point read, not a chained external call per request beyond the existing OpenAI call; no change to the analyze/chat request/response bodies themselves |

**Post-design re-evaluation**: All gates remain satisfied after Phase 1 design (data-model.md, contracts/). No violations requiring exception documentation — see Complexity Tracking (empty).

## Project Structure

### Documentation (this feature)

```text
specs/008-auth-saved-history/
├── plan.md                          ← this file
├── research.md                      ← Phase 0 output
├── data-model.md                    ← Phase 1 output
├── quickstart.md                    ← Phase 1 output
├── contracts/
│   ├── auth.md
│   └── saved-videos-api.md
└── tasks.md                         ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
extension/
├── entrypoints/
│   ├── background.ts                       (modified — hold auth state, gate message handling, refresh token before expiry)
│   └── sidepanel/
│       └── App.tsx                         (modified — add "Saved" tab; wrap authenticated views behind sign-in gate)
├── components/
│   ├── Auth/
│   │   ├── SignInGate.tsx                  (new — renders sign-in prompt / invitation-only message / children)
│   │   └── SignInGate.test.tsx
│   └── Saved/
│       ├── SavedList.tsx                   (new — Saved-view list + empty state, FR-012/FR-017)
│       ├── SavedVideoDetail.tsx             (new — restores summary + chat for a selected saved video, FR-013)
│       └── SaveButton.tsx                   (new — explicit save/unsave action + saved indicator, FR-007/FR-016)
├── services/
│   ├── authClient.ts                       (new — launchWebAuthFlow wrapper, token storage/refresh in chrome.storage.local)
│   ├── savedVideosClient.ts                (new — authenticated fetch wrapper; same read/write shape as sessionCache.ts/chatCache.ts)
│   ├── analysisClient.ts                   (modified — attach Authorization header)
│   └── chatClient.ts                       (modified — attach Authorization header)
├── hooks/
│   └── useAuth.ts                          (new — exposes sign-in state + sign-in/out actions to components)
├── types/
│   ├── auth.ts                             (new — AuthState, AuthenticatedUser types)
│   └── index.ts                            (modified — add SavedVideoSummary and SavedVideoDetail types, mirroring contracts/saved-videos-api.md's list/get-one response shapes, alongside the existing AnalysisResult/Video types)
└── wxt.config.ts                           (modified — add "identity" permission, WXT_GOOGLE_OAUTH_CLIENT_ID define)

functions/
├── src/
│   ├── auth/
│   │   └── index.ts                        (new — 4 app.http registrations: saved-videos list/get/put/delete, each wrapped in withAuth)
│   ├── analyze/
│   │   └── index.ts                        (modified — wrap analyzeHandler in withAuth)
│   ├── chat/
│   │   └── index.ts                        (modified — wrap chatHandler in withAuth)
│   ├── services/
│   │   ├── auth.ts                         (new — withAuth middleware; verifies ID token via google-auth-library)
│   │   ├── allowedUsersStore.ts            (new — AllowedUsers table read; used by services/auth.ts)
│   │   └── savedVideosStore.ts             (new — SavedVideos table CRUD + chat-history chunking + 200-per-account cap check, data-model.md)
│   └── models/
│       └── index.ts                        (modified — SavedVideoRequest/Response types + type guards, FunctionError "not-found"/"unauthenticated"/"not-authorized" codes)
└── scripts/
    └── manage-allowed-users.ts             (new — local CLI: add/remove/list AllowedUsers rows; not part of the deployed Function App package)
```

**Structure Decision**: Both extension and functions follow their existing flat-module conventions — a new `Auth/`/`Saved/` component group mirrors the existing `Chat/`/`KnowledgePanel/` groups, and the backend adds one new route group (`src/auth/` housing the saved-videos endpoints, named for the domain rather than literally "authRoutes" since these are the saved-history routes that now, like everything else, require auth) plus two new `services/` modules, rather than introducing a new backend framework, ORM, or a separate microservice. The `AllowedUsers`/`SavedVideos` tables live in the storage account the Function App already has, so no new Azure resource, resource group, or connection-string plumbing is needed beyond the existing `AzureWebJobsStorage` setting.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
