# Contract: Analyze API

**Endpoint**: `POST /api/analyze`
**Host**: Azure Function App (URL configured via `WXT_AZURE_FUNCTION_URL` build env variable)
**Version**: v1
**Caller**: `extension/services/analysisClient.ts` (via background service worker)

---

## Authentication

All requests MUST include the function-level API key:

```
x-functions-key: <function-key>
```

The key is injected at extension build time via `WXT_AZURE_FUNCTION_KEY` and is not
user-visible. Requests without a valid key receive `401 Unauthorized`.

---

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | ✅ |
| `x-functions-key` | Function API key | ✅ |

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
| `title` | string | ✅ | Non-empty; max 500 chars |
| `channelName` | string | ✅ | Non-empty; max 200 chars |
| `transcript` | string | ✅ | Non-empty; max 200,000 chars (~90-min video) |
| `durationSeconds` | number | ✅ | Positive integer |

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
Access-Control-Allow-Headers: Content-Type, x-functions-key
```

In development, `Access-Control-Allow-Origin: *` is used. In production, the exact extension
ID origin is specified in Azure Function App CORS settings.

---

## Timeout

The extension's `analysisClient.ts` MUST apply a 45-second request timeout. If the function
does not respond within 45 s, the extension surfaces a network error with a retry option.

---

## Rate Limiting

No client-side rate limiting in v1. The Azure Function defers to Azure OpenAI quotas. The
extension handles `429` responses with a 10-second backoff before surfacing the error to the
user.
