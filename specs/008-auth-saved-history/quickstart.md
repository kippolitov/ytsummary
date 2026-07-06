# Quickstart: Sign-In and Saved History

## One-time developer setup (outside this repo's automated tasks)

1. In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web application), and add the extension's `chrome.identity.getRedirectURL()` value (`https://<extension-id>.chromiumapp.org/`) as an authorized redirect URI. Record the client ID for use as `WXT_GOOGLE_OAUTH_CLIENT_ID` (extension) and as the expected `aud` for `google-auth-library` (backend).
2. Ensure the existing Function App's storage account connection string is available locally (`AzureWebJobsStorage` in `functions/local.settings.json`, already present) — the new tables are created in this same account, no new resource.
3. Add at least one developer email to `AllowedUsers` via the CLI (research.md §6):
   ```
   npm run allowed-users -- add you@example.com
   ```

## Validating User Story 1 — sign-in gating (P1)

1. Load the unpacked extension, open the side panel on a YouTube video.
2. **Expected**: a sign-in prompt is shown; the Summary/Chat tabs are not usable yet.
3. Sign in with an email NOT in `AllowedUsers`.
4. **Expected**: an "invitation-only" message; still no access to Summary/Chat.
5. Sign in with the email added in setup step 3.
6. **Expected**: access granted; summary generation and chat work as before this feature.
7. Close and reopen the browser.
8. **Expected**: still signed in, no re-prompt (SC-001, SC-002, spec.md US1).

## Validating User Story 2 & 3 — save and restore (P2)

1. While signed in, view a video's summary, send at least one chat message.
2. Click "Save".
3. **Expected**: the video now shows as saved (FR-016); open the "Saved" tab/view — the video appears in the list.
4. Fully quit and relaunch the browser; sign in again if prompted.
5. Open the Saved view, select the video.
6. **Expected**: summary and full chat history restored exactly, including the earlier message (SC-003).
7. Send one more chat message on the restored, saved video.
8. Reload the Saved view entry again.
9. **Expected**: the new message is present (FR-015).
10. Remove the video from the Saved view.
11. **Expected**: it no longer appears in the list (FR-014); re-saving the same video afterward starts fresh (per Assumptions in spec.md).

## Validating User Story 4 — cross-device (P3)

1. With the video saved from a first browser profile/machine, sign in with the same Google account in a second, separate browser profile.
2. Open the Saved view there.
3. **Expected**: the same saved video, summary, and chat history are present within a few seconds (SC-004).

## Validating User Story 5 — authorized-user management (P3)

1. Run `npm run allowed-users -- remove you@example.com`.
2. In the extension (already signed in as that account), trigger any authenticated action (e.g., open Summary or Saved view).
3. **Expected**: access is now denied with the invitation-only message, without any extension update or backend redeploy (SC-005, FR-006).
4. Re-add the account (`npm run allowed-users -- add you@example.com`) and confirm access returns, and any previously saved videos for that `sub` are still present (Assumptions: saved data is retained across revoke/re-authorize).

## Automated coverage expectations

- **Unit** (functions): `withAuth` middleware (valid/expired/malformed token, verified/unverified email, allowed/not-allowed account) — see Constitution Testing Standards; saved-videos handlers (list/get/put/delete) against a fake `TableClient`.
- **Unit** (extension): `savedVideosClient.ts` request/response mapping and error mapping; new Saved-view components; sign-in state hook.
- **Integration**: `functions/tests/integration` — end-to-end saved-videos round trip against a real (or emulated, e.g. Azurite) Table Storage instance, matching the existing "no hollow mocks" policy for external API interactions.
- **E2E** (extension, Playwright): sign-in gate blocks unauthenticated use; save → restore → unsave flow (mirrors existing `extension/tests/e2e/*` patterns).
