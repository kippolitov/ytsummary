import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

function makeIdToken(payload: Record<string, unknown>): string {
  const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}.fake-signature`;
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);

const validPayload = {
  sub: "user-sub-123",
  email: "user@example.com",
  exp: NOW_SECONDS + 3600,
};

let signIn: typeof import("../../services/authClient").signIn;
let signInSilently: typeof import("../../services/authClient").signInSilently;
let signOut: typeof import("../../services/authClient").signOut;
let getStoredAuth: typeof import("../../services/authClient").getStoredAuth;
let getIdToken: typeof import("../../services/authClient").getIdToken;
let markNotAuthorized: typeof import("../../services/authClient").markNotAuthorized;

beforeAll(async () => {
  vi.stubGlobal("WXT_GOOGLE_OAUTH_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  const mod = await import("../../services/authClient");
  ({ signIn, signInSilently, signOut, getStoredAuth, getIdToken, markNotAuthorized } = mod);
});

function mockRedirect(idToken: string): void {
  vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValue(
    `https://test-extension-id.chromiumapp.org/#id_token=${idToken}&token_type=Bearer`
  );
}

describe("authClient", () => {
  beforeEach(() => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockReset();
    vi.mocked(chrome.storage.local.set).mockReset().mockResolvedValue(undefined);
    vi.mocked(chrome.storage.local.get).mockReset().mockResolvedValue({});
    vi.mocked(chrome.storage.local.remove).mockReset().mockResolvedValue(undefined);
  });

  it("signIn launches an interactive flow and stores the decoded token/expiry", async () => {
    mockRedirect(makeIdToken(validPayload));

    const user = await signIn();

    expect(user).toEqual({ sub: "user-sub-123", email: "user@example.com" });
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: true })
    );
    const [[, storedValue]] = vi.mocked(chrome.storage.local.set).mock.calls.map((call) => [
      call[0],
      Object.values(call[0])[0],
    ]);
    expect(storedValue).toMatchObject({
      expiresAt: validPayload.exp * 1000,
      user: { sub: "user-sub-123", email: "user@example.com" },
      authorizationStatus: "authorized",
    });
  });

  it("signInSilently requests a non-interactive flow and updates the stored token on success", async () => {
    mockRedirect(makeIdToken({ ...validPayload, sub: "renewed-sub" }));

    const user = await signInSilently();

    expect(user).toEqual({ sub: "renewed-sub", email: "user@example.com" });
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false })
    );
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it("signInSilently returns null (never throws) when the silent flow fails", async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockRejectedValue(
      new Error("User interaction required")
    );

    const user = await signInSilently();

    expect(user).toBeNull();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("signOut clears the stored auth", async () => {
    await signOut();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith("ytsummary_auth");
  });

  it("getStoredAuth/getIdToken read back what was stored", async () => {
    const stored = {
      idToken: "abc.def.ghi",
      expiresAt: Date.now() + 1000,
      user: { sub: "s", email: "e@x.com" },
      authorizationStatus: "authorized" as const,
    };
    vi.mocked(chrome.storage.local.get).mockResolvedValue({ ytsummary_auth: stored });

    expect(await getStoredAuth()).toEqual(stored);
    expect(await getIdToken()).toBe("abc.def.ghi");
  });

  it("getIdToken returns null when nothing is stored", async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
    expect(await getIdToken()).toBeNull();
  });

  it("markNotAuthorized flips authorizationStatus without clearing the token", async () => {
    const stored = {
      idToken: "abc.def.ghi",
      expiresAt: Date.now() + 1000,
      user: { sub: "s", email: "e@x.com" },
      authorizationStatus: "authorized" as const,
    };
    vi.mocked(chrome.storage.local.get).mockResolvedValue({ ytsummary_auth: stored });

    await markNotAuthorized();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      ytsummary_auth: { ...stored, authorizationStatus: "not-authorized" },
    });
  });
});
