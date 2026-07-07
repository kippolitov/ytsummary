import { createServer, Server } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

const KEY_ID = "test-key-1";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

let server: Server | null = null;
let certsUrl = "";

/**
 * Starts a local HTTP stub serving Google's PEM-certs response shape
 * (`{ [kid]: certPem }`) so google-auth-library's real verifyIdToken can
 * perform genuine signature verification against a real (test) key, per the
 * constitution's "no hollow mocks" rule for external API interactions.
 */
export async function startGoogleCertsStub(): Promise<string> {
  if (server) return certsUrl;
  server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ [KEY_ID]: publicKeyPem }));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  certsUrl = `http://127.0.0.1:${port}/certs`;
  return certsUrl;
}

export async function stopGoogleCertsStub(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server!.close((err) => (err ? reject(err) : resolve()))
  );
  server = null;
}

export interface TestIdTokenClaims {
  sub: string;
  email: string;
  emailVerified?: boolean;
  audience?: string;
  expiresInSeconds?: number;
}

/** Signs a real, JWKS-verifiable RS256 ID token fixture shaped like Google's. */
export function signTestIdToken(claims: TestIdTokenClaims): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.emailVerified ?? true,
    aud: claims.audience ?? "test-client-id",
    iss: "https://accounts.google.com",
    iat: now,
    exp: now + (claims.expiresInSeconds ?? 3600),
  };
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    header: { kid: KEY_ID, alg: "RS256" },
  });
}
