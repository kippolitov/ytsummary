import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { isAllowed, recordSignIn } from "./allowedUsersStore";
import type { AuthenticatedUser, FunctionError } from "../models/index";

export type AuthenticatedHandler = (
  request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
) => Promise<HttpResponseInit>;

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    // GOOGLE_OAUTH_CERTS_URL overrides Google's public JWKS endpoint — used only by
    // integration tests to point verification at a local stub serving test-signed certs.
    const certsUrl = process.env.GOOGLE_OAUTH_CERTS_URL;
    oauthClient = new OAuth2Client(
      certsUrl ? { endpoints: { oauth2FederatedSignonPemCertsUrl: certsUrl } } : undefined
    );
  }
  return oauthClient;
}

/**
 * Wraps an HTTP handler so it only runs for requests carrying a valid,
 * authorized Google identity (contracts/auth.md). Verification order:
 * bearer header present -> signature/iss/aud/exp via google-auth-library ->
 * email_verified -> AllowedUsers lookup. Any failure short-circuits before
 * the wrapped handler (and any OpenAI call within it) ever runs.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    const authHeader = request.headers.get("authorization");
    const match = authHeader?.match(/^Bearer (.+)$/i);
    if (!match) {
      return unauthenticatedResponse();
    }
    const idToken = match[1];

    let payload: TokenPayload | undefined;
    try {
      const audience = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
      const ticket = await getOAuthClient().verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (err) {
      context.warn("withAuth: ID token verification failed");
      void err;
      return unauthenticatedResponse();
    }

    if (!payload || !payload.sub || !payload.email) {
      return unauthenticatedResponse();
    }
    if (!payload.email_verified) {
      return notAuthorizedResponse();
    }

    const allowed = await isAllowed(payload.email);
    if (!allowed) {
      return notAuthorizedResponse();
    }

    await recordSignIn(payload.email, payload.sub);

    const user: AuthenticatedUser = {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
    };
    return handler(request, context, user);
  };
}

function unauthenticatedResponse(): HttpResponseInit {
  return errorResponse(401, "unauthenticated", "Sign in with Google to continue.");
}

function notAuthorizedResponse(): HttpResponseInit {
  return errorResponse(403, "not-authorized", "Access to this extension is invitation-only.");
}

function errorResponse(status: number, code: string, message: string): HttpResponseInit {
  const body: FunctionError = { error: { code, message } };
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    jsonBody: body,
  };
}
