import type { AuthenticatedUser } from "../types/auth";

declare const WXT_GOOGLE_OAUTH_CLIENT_ID: string;

const STORAGE_KEY = "ytsummary_auth";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export interface StoredAuth {
  idToken: string;
  expiresAt: number;
  user: AuthenticatedUser;
  authorizationStatus: "authorized" | "not-authorized";
}

interface DecodedIdToken {
  sub: string;
  email: string;
  exp: number;
}

function decodeIdToken(idToken: string): DecodedIdToken {
  const segments = idToken.split(".");
  if (segments.length !== 3) {
    throw new Error("Malformed ID token.");
  }
  const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = atob(padded);
  const payload = JSON.parse(json) as { sub?: string; email?: string; exp?: number };
  if (!payload.sub || !payload.email || !payload.exp) {
    throw new Error("ID token is missing required claims.");
  }
  return { sub: payload.sub, email: payload.email, exp: payload.exp };
}

function buildAuthUrl(nonce: string): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", WXT_GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("redirect_uri", chrome.identity.getRedirectURL());
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

function extractIdTokenFromRedirect(redirectUrl: string): string {
  const hash = new URL(redirectUrl).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const idToken = params.get("id_token");
  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }
  return idToken;
}

async function launchFlow(interactive: boolean): Promise<StoredAuth> {
  if (!WXT_GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("Google sign-in is not configured.");
  }
  const nonce = crypto.randomUUID();
  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: buildAuthUrl(nonce),
    interactive,
  });
  if (!redirectUrl) {
    throw new Error("Google sign-in did not complete.");
  }
  const idToken = extractIdTokenFromRedirect(redirectUrl);
  const decoded = decodeIdToken(idToken);
  const stored: StoredAuth = {
    idToken,
    expiresAt: decoded.exp * 1000,
    user: { sub: decoded.sub, email: decoded.email },
    authorizationStatus: "authorized",
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
  return stored;
}

/** Interactive Google sign-in — shows the account chooser/consent UI. */
export async function signIn(): Promise<AuthenticatedUser> {
  const stored = await launchFlow(true);
  return stored.user;
}

/** Attempts a non-interactive renewal using Google's existing browser session; returns null (never throws) on failure. */
export async function signInSilently(): Promise<AuthenticatedUser | null> {
  try {
    const stored = await launchFlow(false);
    return stored.user;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as StoredAuth | undefined) ?? null;
}

/** The bearer token for API calls, regardless of expiry — the backend is the source of truth for validity. */
export async function getIdToken(): Promise<string | null> {
  const stored = await getStoredAuth();
  return stored?.idToken ?? null;
}

/** Marks the signed-in account as rejected by the AllowedUsers check (backend 403), without signing out of Google. */
export async function markNotAuthorized(): Promise<void> {
  const stored = await getStoredAuth();
  if (!stored) return;
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...stored, authorizationStatus: "not-authorized" },
  });
}
