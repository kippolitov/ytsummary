import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpRequest, InvocationContext, HttpResponseInit } from "@azure/functions";

const verifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}));

vi.mock("../../src/services/allowedUsersStore", () => ({
  isAllowed: vi.fn(),
  recordSignIn: vi.fn(),
}));

import { withAuth } from "../../src/services/auth";
import { isAllowed, recordSignIn } from "../../src/services/allowedUsersStore";

function makeRequest(authHeader?: string): HttpRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;
}

describe("withAuth", () => {
  const handler = vi.fn(
    () => Promise.resolve({ status: 200, jsonBody: { ok: true } }) as Promise<HttpResponseInit>
  );

  beforeEach(() => {
    verifyIdToken.mockReset();
    vi.mocked(isAllowed).mockReset();
    vi.mocked(recordSignIn).mockReset().mockResolvedValue(undefined);
    handler.mockClear();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await withAuth(handler)(makeRequest(), makeContext());
    expect(response.status).toBe(401);
    expect((response.jsonBody as { error: { code: string } }).error.code).toBe(
      "unauthenticated"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the header is malformed (not 'Bearer <token>')", async () => {
    const response = await withAuth(handler)(makeRequest("Token abc"), makeContext());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when verifyIdToken throws (expired token or invalid signature)", async () => {
    verifyIdToken.mockRejectedValue(new Error("Token used too late"));
    const response = await withAuth(handler)(makeRequest("Bearer bad"), makeContext());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the verified payload is missing sub/email", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email_verified: true }) });
    const response = await withAuth(handler)(makeRequest("Bearer good"), makeContext());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when email_verified is false, without checking AllowedUsers", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "123", email: "a@b.com", email_verified: false }),
    });
    const response = await withAuth(handler)(makeRequest("Bearer good"), makeContext());
    expect(response.status).toBe(403);
    expect((response.jsonBody as { error: { code: string } }).error.code).toBe(
      "not-authorized"
    );
    expect(isAllowed).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is not in AllowedUsers", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "123", email: "a@b.com", email_verified: true }),
    });
    vi.mocked(isAllowed).mockResolvedValue(false);
    const response = await withAuth(handler)(makeRequest("Bearer good"), makeContext());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 for a previously-authorized account subsequently removed (FR-006)", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "123", email: "revoked@example.com", email_verified: true }),
    });
    vi.mocked(isAllowed).mockResolvedValue(false);
    const response = await withAuth(handler)(makeRequest("Bearer good"), makeContext());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the wrapped handler with the authenticated user on the happy path", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "123", email: "A@B.com", email_verified: true }),
    });
    vi.mocked(isAllowed).mockResolvedValue(true);

    const response = await withAuth(handler)(makeRequest("Bearer good"), makeContext());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      sub: "123",
      email: "a@b.com",
    });
    expect(recordSignIn).toHaveBeenCalledWith("A@B.com", "123");
  });
});
