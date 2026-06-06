# Contract: Analyze API

**Endpoint**: `POST /api/analyze`
**Host**: Azure Function App (URL configured via `WXT_AZURE_FUNCTION_URL` build env variable)
**Version**: v1
**Caller**: `extension/services/analysisClient.ts` (via background service worker)

---

## Authentication

All requests MUST include the function-level API key as a URL query parameter:

```
POST /api/analyze?code=<function-key>
```

The key is injected at extension build time via `WXT_AZURE_FUNCTION_KEY` and appended to the
URL by `analysisClient.ts` before the request is made. Requests without a valid key receive
`401 Unauthorized`.

> **Why `?code=` and not `x-functions-key` header**: Azure Functions validates the function key
> *before* applying CORS headers. Sending the key as a custom header causes the browser's CORS
> preflight (OPTIONS) to receive a 401 with no `Access-Control-Allow-Origin` header, blocking
> all requests from the extension. Passing the key as a URL parameter avoids this because the
> OPTIONS preflight carries no body or custom headers.

---

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | ✅ |

### Body

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Introduction to Dependency Injection in .NET",
  "channelName": "dotnet",
  "transcript": "In this video we'll explore dependency injection...",
  "durationSeconds": 632
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `videoId` | string | ✅ | Matches `/^[a-zA-Z0-9_-]{11}$/` |
| `title` | string | ✅ | Max 500 chars; may be empty string |
| `channelName` | string | ✅ | Max 200 chars; may be empty string |
| `transcript` | string | ✅ | Max 200,000 chars (~90-min video); **may be empty string** — if empty, the function attempts server-side transcript fetching via the `youtube-transcript` package |
| `durationSeconds` | number | ✅ | Non-negative integer (`>= 0`) |

> **Transcript fallback**: When `transcript` is empty the server calls `transcriptFetcher.ts`
> which uses YouTube's InnerTube API and HTML scraping. This fallback may be blocked when the
> Azure Function's outbound IP is rate-limited by YouTube; in that case the function returns
> `422 no-transcript`. The preferred path is for the client to send the transcript extracted
> by `captionExtractor.content.ts`.

---

## Success Response — `200 OK`

```json
{
  "videoId": "dQw4w9WgXcQ",
  "summary": "This video introduces dependency injection (DI) in .NET, explaining how the built-in DI container works and why it improves testability. The presenter walks through registering services with different lifetimes—transient, scoped, and singleton—and demonstrates injecting dependencies via constructor injection. By the end, viewers understand when to use each lifetime and how to avoid common pitfalls such as captive dependencies.",
  "topics": [
    {
      "name": "Dependency Injection",
      "description": "Core DI concepts: what it is, why it decouples components, and how .NET's built-in container implements it.",
      "timestampSeconds": 45
    },
    {
      "name": "Service Lifetimes",
      "description": "Comparison of transient, scoped, and singleton lifetimes with practical guidance on choosing between them.",
      "timestampSeconds": 312
    }
  ],
  "steps": [
    {
      "order": 1,
      "text": "Create a new .NET project with `dotnet new webapi`.",
      "timestampSeconds": 118
    },
    {
      "order": 2,
      "text": "Register a service in `Program.cs` using `builder.Services.AddTransient<IMyService, MyService>()`.",
      "timestampSeconds": 195
    }
  ],
  "references": [
    {
      "name": "Microsoft.Extensions.DependencyInjection",
      "description": "The built-in .NET DI container library used throughout the demo.",
      "url": "https://www.nuget.org/packages/Microsoft.Extensions.DependencyInjection",
      "context": "Presenter says: 'We're using Microsoft.Extensions.DependencyInjection, which ships with .NET 6 and later.'"
    }
  ],
  "analyzedAt": "2026-06-05T14:32:10Z"
}
```

### Response fields

| Field | Type | Always present | Description |
|-------|------|----------------|-------------|
| `videoId` | string | ✅ | Echo of request `videoId` |
| `summary` | string | ✅ | 3–5 sentence overview |
| `topics` | Topic[] | ✅ | May be empty array `[]` |
| `steps` | Step[] | ✅ | Empty `[]` when video has no procedural content |
| `references` | Reference[] | ✅ | Empty `[]` when no resources mentioned |
| `analyzedAt` | string | ✅ | ISO 8601 UTC timestamp |

---

## Error Responses

All error responses use this shape:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

| HTTP Status | `error.code` | Cause | Extension action |
|-------------|-------------|-------|-----------------|
| `400 Bad Request` | `invalid-request` | Missing or malformed required field | Show error; do not retry automatically |
| `422 Unprocessable Entity` | `no-transcript` | Client sent empty transcript and server-side fetch also failed (video has no captions, or Azure IP blocked by YouTube) | Show "no captions available" message; do not retry automatically |
| `422 Unprocessable Entity` | `transcript-too-long` | Transcript exceeds 200,000 chars | Show message: "Video is too long to analyze in v1" |
| `429 Too Many Requests` | `rate-limited` | Azure OpenAI rate limit hit | Show error with "Try again in a moment"; retry after 10 s |
| `500 Internal Server Error` | `service-error` | Azure OpenAI or function error | Show error with retry action |
| `503 Service Unavailable` | `service-unavailable` | Function cold start timeout or Azure outage | Show error with retry action |

---

## CORS

The Azure Function MUST include these response headers for the extension origin:

```
Access-Control-Allow-Origin: chrome-extension://<extensionId>
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

In development and production, `Access-Control-Allow-Origin: *` is acceptable (configured via
`az functionapp cors add`). The extension origin `chrome-extension://<id>` can be added for
stricter production hardening.

> **Note**: `x-functions-key` is no longer listed in `Access-Control-Allow-Headers` because
> the key is passed as `?code=` query parameter, not a header. Removing it from CORS headers
> eliminates the preflight complexity that previously caused `401` errors.

---

## Timeout

The extension's `analysisClient.ts` MUST apply a 45-second request timeout. If the function
does not respond within 45 s, the extension surfaces a network error with a retry option.

---

## Rate Limiting

No client-side rate limiting in v1. The Azure Function defers to Azure OpenAI quotas. The
extension handles `429` responses with a 10-second backoff before surfacing the error to the
user.
