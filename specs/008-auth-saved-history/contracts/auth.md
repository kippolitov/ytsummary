# Contract: Authentication (shared across all HTTP-triggered functions)

Applies to every non-`OPTIONS` route: `POST /api/analyze`, `POST /api/chat`, and all `/api/saved-videos*` routes below.

## Request

Every authenticated request MUST include:

```
Authorization: Bearer <google-id-token>
```

The existing `x-functions-key` / `?code=` function-key mechanism remains as today's transport-level protection (unchanged); the bearer token is the new, additional user-identity layer checked by application code.

## Verification steps (executed by the shared `withAuth` middleware, in order)

1. `Authorization` header present and well-formed (`Bearer <token>`) → else `401`.
2. Token signature, `iss` (`accounts.google.com` / `https://accounts.google.com`), `aud` (this app's OAuth client ID), and `exp` verified via `google-auth-library`'s `verifyIdToken` → else `401`.
3. Decoded `email_verified` claim MUST be `true` → else `403`.
4. `AllowedUsers` table lookup by lowercased `email` MUST return a row → else `403`.
5. On success, handler receives `{ sub, email }` and proceeds; on any failure above, the wrapped business handler (including any OpenAI call) never runs.

## Responses (failure)

```json
// 401 — missing/invalid/expired token
{ "error": { "code": "unauthenticated", "message": "Sign in with Google to continue." } }

// 403 — valid Google identity, but not on the authorized list
{ "error": { "code": "not-authorized", "message": "Access to this extension is invitation-only." } }
```

Both reuse the existing `FunctionError` shape (`functions/src/models/index.ts`) already used by `analyze`/`chat` error responses, so existing client-side error-mapping (`analysisClient.ts`, `chatClient.ts`) only needs new `code` branches, not a new response envelope.

## Notes

- `OPTIONS` preflight handlers are unchanged (`authLevel: "anonymous"`, no bearer check, per existing CORS pattern).
- No server-side session/cookie is created; every request is independently verified (stateless), which is what makes revocation "prompt" (FR-006) — there is no cached authorization decision to invalidate.
