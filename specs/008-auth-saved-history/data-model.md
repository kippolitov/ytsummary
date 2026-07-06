# Phase 1 Data Model: Sign-In and Saved History

Storage: Azure Table Storage, in the existing Function App's storage account (`AzureWebJobsStorage`), accessed via `@azure/data-tables`. Two new tables: `AllowedUsers` and `SavedVideos`.

## AllowedUsers

Developer-managed authorization list. Small (tens to low hundreds of rows), read on every authenticated request, written only via the local CLI (research.md §6).

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | Constant `"AllowedUser"` — all rows share one partition; table stays small enough that this doesn't create a hot-partition problem. |
| `RowKey` | string | The account's Google email, lowercased and trimmed. Table Storage forbids `/ \ # ?` in keys; email addresses never contain these. |
| `sub` | string | Google's stable account identifier (the ID token's `sub` claim). Empty until the account's first successful sign-in; populated then for cross-reference into `SavedVideos.PartitionKey`. |
| `addedAt` | string (ISO 8601) | When the developer authorized this account. |
| `addedBy` | string | Free-text note (e.g., developer's own identifier) — operational metadata only, not enforced. |

**Validation rules**:
- `RowKey` (email) MUST be present and lowercase before write; the CLI normalizes on input.
- Authorization check = "a row with `RowKey == lowercase(idToken.email)` exists." `email_verified` on the ID token MUST also be `true`, independent of the table lookup.

**State transitions**: row exists (authorized) ⇄ row absent (not authorized / revoked). No soft-delete — removal is a hard delete, satisfying "changes take effect... without redeploying" (FR-005) and "prompt" revocation (FR-006), since every request re-queries the table.

## SavedVideos

A user's explicitly saved videos. Partitioned per user so listing a user's saved videos is a single-partition query.

| Property | Type | Notes |
|---|---|---|
| `PartitionKey` | string | The Google `sub` of the owning user (FR-010: strict per-user scoping). |
| `RowKey` | string | The YouTube `videoId` (matches the existing `^[a-zA-Z0-9_-]{11}$` pattern already validated in `functions/src/models/index.ts`). |
| `videoTitle` | string | ≤ 500 chars, mirrors `AnalyzeRequest.title`. |
| `channelName` | string | ≤ 200 chars, mirrors `AnalyzeRequest.channelName`. |
| `videoUrl` | string | Canonical video URL, for display/re-navigation in the Saved view. |
| `durationSeconds` | number | Mirrors `Video.durationSeconds`. |
| `summaryJson` | string | `JSON.stringify(AnalysisResult)` (the existing `tldr`/`topics`/`steps`/`references`/`analyzedAt` shape from `extension/types/index.ts` and `functions/src/models/index.ts`) — same shape as today's in-session cache, just persisted. |
| `chatJson0`..`chatJson3` | string (each ≤ 64 KiB) | The serialized `ChatMessage[]` (existing shape from `extension/types/chat.ts`), split into contiguous chunks across up to 4 properties (research.md §5). Unused trailing chunk properties are omitted, not stored empty. |
| `savedAt` | string (ISO 8601) | Set once, on first save; not overwritten on later updates. |
| `updatedAt` | string (ISO 8601) | Refreshed on every save/append so cross-device sync (US4) can reason about recency if ever needed. |

**Validation rules**:
- `PartitionKey` MUST equal the authenticated caller's `sub` on every read/write/delete — enforced in the handler, never taken from the request body, so no caller can address another user's partition (FR-010).
- `chatJson0..3` concatenation, when non-empty, MUST parse as a JSON array of `ChatMessage`; if the array would exceed the existing 50-message cap, the oldest messages are dropped first (same policy as `chatCache.ts`'s `MAX_MESSAGES`), consistent with FR-018 (never leave a save in an inconsistent state — a save that would overflow storage limits truncates rather than fails).
- A `SavedVideo` entity's absence for a given `(sub, videoId)` pair is the "not saved" state (FR-016 relies on this presence check).

**State transitions**:
- *(none)* → **saved**: created by the "Save" action (US2), `savedAt = updatedAt = now`.
- **saved** → **saved** (updated): new chat messages appended after saving (FR-015) update `chatJson*` and `updatedAt`; re-saving (e.g., regenerated summary) updates `summaryJson` and `updatedAt`.
- **saved** → *(none)*: explicit "unsave"/delete (US3 scenario 4) — hard delete of the row, per the Assumptions section of spec.md ("fresh save" after re-saving, no resurrection of old data).

## Runtime (non-persisted) concepts

- **AuthenticatedUser**: `{ sub: string; email: string }`, attached to the request context by the `withAuth` middleware (research.md §3) after successful ID-token verification and `AllowedUsers` lookup. Not stored — recomputed from the bearer token on every request.
- **Unsaved / session-scoped video state**: unchanged from today — remains in `chrome.storage.session` via the existing `sessionCache.ts` / `chatCache.ts`, out of scope for the new tables (FR-009).
