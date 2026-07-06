# Phase 0 Research: Sign-In and Saved History

## 1. Obtaining a Google ID token in a Manifest V3 Chrome extension

**Decision**: Use `chrome.identity.launchWebAuthFlow()` against Google's OAuth 2.0 authorization endpoint with `response_type=id_token`, a per-request `nonce`, and `redirect_uri = chrome.identity.getRedirectURL()`, extracting the `id_token` from the redirect URL's hash fragment. Persist the token (and its decoded `exp`) in `chrome.storage.local` (not `.session`, since it must survive browser restarts per FR-006/US1 scenario 4). Attempt silent, non-interactive renewal (`interactive: false`) before expiry; on failure, fall back to an interactive prompt.

**Rationale**: The feature description says to use `chrome.identity.getAuthToken()` "to obtain a Google ID token." In practice, `getAuthToken()` is documented by Chrome to return an **OAuth2 access token** scoped to APIs listed in the manifest's `oauth2.scopes` — it does not return a signed ID token JWT, and Google/opaque access tokens generally cannot be verified locally via JWKS. Since the explicit requirement is to verify the token's **signature via Google's JWKS**, the token must be a real ID token (a JWT with `iss`/`aud`/`exp`/`sub`/`email` claims signed by Google). The standard, documented pattern for extensions that need a verifiable ID token (rather than API access) is `launchWebAuthFlow` requesting `response_type=id_token` — this is the mechanism used in this plan; `getAuthToken()` is not used. This is called out explicitly here because it changes concrete implementation tasks versus a literal reading of the feature request.

**Alternatives considered**:
- *`getAuthToken()` + Google `tokeninfo`/`userinfo` endpoint call per request*: would satisfy "identify the account" but requires an extra outbound call to Google on every backend request and does not provide a self-contained, JWKS-verifiable signed credential — rejected because it contradicts the explicit "verify signature via JWKS" requirement and adds latency to every request.
- *Full Google Identity Services (GIS) "Sign In With Google" web SDK inside the side panel*: designed for regular web pages, not extension side-panel contexts, and has known friction inside `chrome-extension://` origins — rejected in favor of the extension-native `chrome.identity` API.

## 2. Verifying the ID token server-side (Azure Functions)

**Decision**: Use Google's official `google-auth-library` npm package's `OAuth2Client.verifyIdToken({ idToken, audience })`. It fetches and caches Google's JWKS internally, verifies the signature, and validates `aud`, `iss`, and `exp` in one call, returning the decoded payload (`sub`, `email`, `email_verified`, `exp`, ...).

**Rationale**: This is the officially maintained library for exactly this task; hand-rolling JWKS fetch/cache/rotation logic (e.g., with `jwks-rsa` + `jsonwebtoken`) duplicates what Google already ships and maintains, and is more likely to drift when Google rotates signing keys. Using it keeps the shared auth middleware small and testable.

**Alternatives considered**:
- `jsonwebtoken` + `jwks-rsa` (manual JWKS client with a signing-key cache) — viable, more code to own and test; rejected in favor of the official library.
- `jose` (generic JWT/JWK library) with a manual `createRemoteJWKSet` pointed at Google's certs — viable and lighter-weight, but still requires hand-coding the `aud`/`iss` checks Google's own library already encapsulates — rejected for the same reason.

## 3. Shared authentication/authorization middleware across Azure Functions (v4 programmatic model)

**Decision**: Azure Functions v4's Node programmatic model registers handlers directly via `app.http(name, { handler, ... })` with no built-in middleware chain. Implement a single higher-order function `withAuth(handler)` in `functions/src/services/auth.ts` that: extracts the `Authorization: Bearer <idToken>` header, verifies it (§2), looks up the account in the `AllowedUsers` table (§4), and either calls the wrapped handler with an added `AuthenticatedUser` context or short-circuits with a `403` (invitation-only message) — all before any OpenAI-touching code runs. Every non-preflight `app.http` registration (`analyze`, `chat`, and the four new saved-history endpoints) wraps its handler in `withAuth(...)`; `OPTIONS` preflight handlers remain `authLevel: "anonymous"` and unwrapped, matching the existing CORS pattern.

**Rationale**: Keeps the change additive and consistent with the existing per-function `app.http(...)` registration style (see `functions/src/analyze/index.ts`, `functions/src/chat/index.ts`) rather than introducing a new framework or routing layer.

**Alternatives considered**:
- A custom Azure Functions "Extension"/hook API (v4 supports `app.hook.*` lifecycle hooks) — technically possible but less explicit at each route's registration site and harder to unit-test in isolation; rejected in favor of a plain wrapping function.

## 4. Storing `AllowedUsers` and `SavedVideos` in Azure Table Storage

**Decision**: Add the `@azure/data-tables` SDK and two tables inside the **existing** Function App's storage account (the same account backing `AzureWebJobsStorage`) — no new storage account or resource group. `AllowedUsers`: `PartitionKey = "AllowedUser"` (constant), `RowKey = <lowercased email>`, with a `sub` column populated on first successful sign-in. `SavedVideos`: `PartitionKey = <Google sub>`, `RowKey = <videoId>`, storing the video's identity fields, the summary payload, and the chat history (see data-model.md for the exact shape and size-limit handling).

**Rationale**: The feature description explicitly directs reuse of the existing storage account (no new resource group) and Table Storage specifically. Keying `AllowedUsers` by email matches how a developer naturally thinks about inviting people ("add kippolitov@gmail.com"); keying `SavedVideos` by `sub` matches the explicit instruction and is immune to email changes on the Google account.

**Alternatives considered**:
- Cosmos DB Table API — richer indexing/query, but is new infrastructure beyond "reuse the existing storage account" — rejected as out of scope for this feature's explicit constraint.
- A single combined table for both concerns — rejected; access patterns and lifecycles differ (`AllowedUsers` is small and admin-managed, `SavedVideos` is per-user and can grow), and Table Storage has no cost benefit to combining them.

## 5. Handling Azure Table Storage's per-property size limit for saved chat history

**Decision**: Azure Table Storage caps each `String` entity property at 64 KiB and total entity size at ~1 MiB. The existing client-side cap of 50 messages per chat (`MAX_MESSAGES` in `chatCache.ts` / `chat/index.ts`) keeps typical serialized chat history well under 64 KiB, but is not a hard guarantee (long individual messages, rich markdown/code blocks). Store the serialized chat history split across a small, fixed number of numbered string properties (`chatJson0`, `chatJson1`, `chatJson2`, `chatJson3` — 4 × 64 KiB ≈ 256 KiB budget, comfortably inside the 1 MiB entity ceiling alongside the summary payload), each holding a contiguous slice of the JSON string; on read, concatenate present chunks in order and `JSON.parse` the result. If the serialized payload would exceed the total chunk budget, truncate to the most recent messages (same "keep most recent" policy already used by `MAX_MESSAGES`) rather than failing the save.

**Rationale**: Keeps the storage layer a plain flat entity (fast point reads/writes, no secondary blob round-trip) while tolerating occasional oversized histories without introducing Blob Storage as a second storage primitive for this feature.

**Alternatives considered**:
- Store chat history as a blob in Azure Blob Storage, referenced by URL from the table row — more headroom, but introduces a second storage service, a second failure mode (partial write across two stores), and is unnecessary given the existing message cap — rejected unless real usage proves the chunk budget insufficient.

## 6. Developer-facing AllowedUsers management (no redeploy, no new extension version)

**Decision**: A small standalone Node/TypeScript script (`functions/scripts/manage-allowed-users.ts`, run via `ts-node` or a compiled `dist` output, e.g. `npm run allowed-users -- add <email>` / `remove <email>` / `list`) that talks directly to the same Table Storage account via `@azure/data-tables`, using the storage connection string from the developer's local environment (the same one the Function App uses in Azure — read from an env var, never hard-coded). It is not exposed as an HTTP endpoint and ships only in the repo, not in the extension bundle or the deployed Function App package.

**Rationale**: Satisfies "add or remove authorized users without shipping a new extension version or redeploying the backend" — the table is external, mutable state; the script is a thin, local operational tool, consistent with "not a public endpoint" from the feature description.

**Alternatives considered**:
- An authenticated admin HTTP endpoint on the Function App — rejected: explicitly excluded by the feature description ("not a public endpoint") and adds an unnecessary privileged attack surface.
- Direct manual edits via Azure Storage Explorer / Portal — viable as a fallback but not scriptable/repeatable; the CLI is the primary supported path, portal editing remains an acceptable manual alternative and needs no separate design.

## 7. Client-side "Saved" backing-store swap without changing the read/write shape

**Decision**: Introduce a `savedVideosClient.ts` service in the extension with the same functional shape (by videoId) that `sessionCache.ts`/`chatCache.ts` already expose (`getSavedVideo`, `saveVideo`, `listSavedVideos`, `deleteSavedVideo`), but backed by authenticated `fetch` calls to the four new endpoints instead of `chrome.storage.session`. Existing consumers of the session cache are unchanged; a new explicit "Save" action in the UI is the only new call site, plus the new "Saved" view which lists/reads/deletes through this client.

**Rationale**: Matches the explicit instruction that "the client-side interface for reading/writing a saved video changes its backing store, not its shape" — minimizes churn in existing chat/summary rendering components, which just receive the same `AnalysisResult`/`ChatMessage[]` shapes regardless of origin.

**Alternatives considered**: None — this was explicitly directed in the feature description.
