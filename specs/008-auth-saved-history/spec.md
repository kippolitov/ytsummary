# Feature Specification: Sign-In and Saved History

**Feature Branch**: `008-auth-saved-history`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Add the ability for users to save a video's summary and chat conversation so it persists indefinitely, instead of the current behavior where everything lives in chrome.storage.session and is lost the moment the browser closes. Users must sign in with their Google account before using any part of the extension — generating a summary, chatting about a video, or viewing saved history all require an authenticated session. Only Google accounts the developer has explicitly authorized may use the extension; anyone else attempting to sign in sees a clear message that access is invitation-only. Once signed in with an authorized account, the user gets a "Saved" view (similar in spirit to a reading-list) listing videos they've explicitly saved, each showing its summary and full chat history, restorable at any time. Saved data is scoped strictly to the signed-in user and available from any device/browser where they sign in with the same account. Unsaved videos continue to behave as they do today (session-only, cleared on browser close) — saving is an explicit user action, not automatic for every video viewed. The developer needs to add or remove authorized users without shipping a new extension version or redeploying the backend."

## Clarifications

### Session 2026-07-06

- Q: SC-003 promises "complete chat message history" restored with 100% fidelity, but the existing codebase already caps live chat sessions at 50 messages. Should saved chat history preserve every message ever sent (unbounded), or inherit the same 50-message cap as today's live sessions? → A: Cap at 50 messages, matching existing live-session behavior; oldest messages drop first.
- Q: Should there be a maximum number of videos a single user can have saved at once? → A: Cap at 200 per user; a user at the cap must remove an existing saved video before saving a new one.
- Q: How long should a signed-in user remain authenticated before needing to interactively re-authenticate? → A: 30 days, as long as silent token refresh keeps succeeding; a failed silent refresh (e.g., past 30 days, or the underlying Google session ended) prompts an interactive sign-in.
- Q: Should the tentative last-write-wins approach for the rare same-account, two-device concurrent edit be locked in as a firm requirement? → A: Yes, confirmed as a firm requirement — the most recent save overwrites the prior one, no merge or conflict UI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In With an Authorized Google Account (Priority: P1)

A new or returning user opens the extension and is presented with a sign-in prompt before they can do anything else. They sign in with their Google account. If the developer has authorized that account, they land in the extension exactly where they'd expect (able to generate a summary or chat), now attributed to their identity. If the account is not authorized, they see a clear, friendly message explaining that access is invitation-only, with no path to use the extension's features.

**Why this priority**: Every other capability in this feature — saving, viewing saved history, cross-device sync — depends on knowing who the user is. Without a working, gated sign-in, nothing else can be built or tested.

**Independent Test**: Can be fully tested by installing the extension fresh, attempting to open the summary or chat view without signing in (confirming it's blocked), signing in with an authorized test account (confirming access is granted), and signing in with an unauthorized account (confirming the invitation-only message appears and no features are reachable).

**Acceptance Scenarios**:

1. **Given** the user has never signed in, **When** they open the extension, **Then** they are shown a sign-in prompt and cannot generate a summary, chat, or view saved history until they sign in.
2. **Given** the user signs in with a Google account the developer has authorized, **When** sign-in completes, **Then** they are granted full access to the extension's features.
3. **Given** the user signs in with a Google account the developer has NOT authorized, **When** sign-in completes, **Then** they see a clear message stating access is invitation-only, and they are not granted access to summary, chat, or saved-history features.
4. **Given** a previously signed-in, authorized user closes and reopens the browser, **When** they open the extension within 30 days of last use and silent token refresh succeeds, **Then** they remain signed in without needing to interactively authenticate again.
5. **Given** a signed-in user, **When** they choose to sign out, **Then** they immediately lose access to summary, chat, and saved-history features until they sign in again.

---

### User Story 2 - Save a Video's Summary and Chat for Later (Priority: P2)

While viewing a video's summary or chatting about it, a signed-in, authorized user explicitly chooses to save it. From that point on, the video's summary and the full chat conversation are preserved indefinitely, even after the browser is closed, the extension is reinstalled, or the user switches devices.

**Why this priority**: This is the core value proposition of the feature — turning ephemeral, session-only content into something durable — but it only makes sense once sign-in (P1) exists to scope the saved data to a person.

**Independent Test**: Can be fully tested by signing in, generating a summary and having a chat exchange about a video, explicitly saving it, closing the browser entirely, reopening it, and confirming the summary and full chat history are still available and unchanged.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing a video's summary, **When** they choose to save it, **Then** the summary is persisted indefinitely and associated with their account.
2. **Given** a signed-in user has an ongoing chat conversation about a video, **When** they save that video, **Then** the full chat history up to that point is persisted along with the summary.
3. **Given** a user has saved a video, **When** they continue chatting about it afterward, **Then** new messages are also persisted as part of the saved conversation.
4. **Given** a user has NOT saved a video, **When** they close the browser, **Then** that video's summary and chat are lost, exactly as today's session-only behavior.
5. **Given** a user saves a video, **When** they check the save state later (e.g., revisiting the same video), **Then** the extension correctly indicates the video is already saved rather than offering to save it again.

---

### User Story 3 - Browse and Restore Saved Videos (Priority: P2)

A signed-in user opens a "Saved" view within the extension and sees a list of every video they've previously saved. Selecting one restores its summary and full chat history exactly as it was, and the user can continue chatting from where they left off.

**Why this priority**: Saving data (P2/US2) is only useful if the user can find and return to it. This view is the primary way saved content delivers ongoing value, on par with the saving action itself.

**Independent Test**: Can be fully tested by saving two or more distinct videos, opening the Saved view, confirming all saved videos are listed with identifying information (e.g., title), selecting one, and confirming its summary and chat restore fully and correctly.

**Acceptance Scenarios**:

1. **Given** a signed-in user has saved one or more videos, **When** they open the Saved view, **Then** they see a list of those videos, each identifiable (e.g., by title and thumbnail or channel).
2. **Given** the Saved view is open, **When** the user selects a saved video, **Then** its summary and complete chat history are restored and displayed as they were when saved (plus any messages added since).
3. **Given** a signed-in user has saved no videos, **When** they open the Saved view, **Then** they see a clear empty state explaining how to save a video, rather than an error or blank screen.
4. **Given** a user has saved videos, **When** they choose to remove/unsave one from the Saved view, **Then** it is permanently removed from their saved history and no longer appears in the list.

---

### User Story 4 - Access Saved History From Any Device (Priority: P3)

A user who saved videos on one computer signs in with the same Google account on a different computer or browser. Their Saved view shows the same videos, summaries, and chat histories, without any manual export/import step.

**Why this priority**: Cross-device availability is a natural extension of having an authenticated, server-scoped save rather than local-only storage, but the extension delivers meaningful value on a single device first (P1–P2 cover that). This is the polish that fulfills the "available from any device" promise explicitly called out in scope.

**Independent Test**: Can be fully tested by saving a video while signed in on one browser profile/machine, signing in with the same account on a separate browser profile/machine, and confirming the same saved video, summary, and chat appear in the Saved view there.

**Acceptance Scenarios**:

1. **Given** a user saved a video while signed in on Device A, **When** they sign in with the same Google account on Device B, **Then** the saved video appears in their Saved view on Device B with the identical summary and chat history.
2. **Given** a user updates saved chat history on Device A (e.g., adds new chat messages to a saved video), **When** they subsequently view that same saved video on Device B, **Then** the updated chat history is reflected there.

---

### User Story 5 - Developer Manages the Authorized User List (Priority: P3)

The developer adds a new Google account to the authorized list (e.g., to invite a beta tester) or removes one (e.g., to revoke access), and the change takes effect for that user's next sign-in attempt — without the developer publishing a new version of the extension or redeploying the backend.

**Why this priority**: This is an operational/administrative capability rather than an end-user-facing one. It's essential for the developer to manage access over time, but it doesn't block the core end-user experience (P1–P4) from being built and validated with an initial authorized list.

**Independent Test**: Can be fully tested by having the developer add a new account to the authorized list through whatever management mechanism is provided, confirming that account can now sign in successfully without any new deployment, then removing it and confirming it is denied access on its next sign-in attempt.

**Acceptance Scenarios**:

1. **Given** an account is not on the authorized list, **When** the developer adds it through the management mechanism, **Then** that account can sign in successfully on its next attempt, with no extension update or backend redeployment required.
2. **Given** an account is currently authorized, **When** the developer removes it through the management mechanism, **Then** that account is denied access (shown the invitation-only message) on its next sign-in attempt or next authenticated action, with no extension update or backend redeployment required.

---

### Edge Cases

- What happens when a user is signed in and using the extension, but the developer revokes their authorization mid-session? The user's in-progress session should be cut off (denied further access) rather than allowed to continue indefinitely on stale authorization.
- What happens when a user tries to save a video while offline or when the save operation fails partway through? The user should see a clear failure indication and the video should not be left in an ambiguous or partially-saved state; unsaved content continues to behave as session-only.
- What happens when a user saves a video, then later deletes/unsaves it, then tries to save it again? The system should treat this as a fresh save rather than resurrecting old data.
- What happens when a user reaches the 200-saved-video cap and tries to save another? The save is rejected with a clear message telling them to remove an existing saved video first (FR-019).
- What happens when a saved video's chat history exceeds 50 messages? Only the most recent 50 are preserved, matching today's live-session cap; older messages are dropped from the saved copy (FR-008a).
- What happens when the same Google account is signed in on two devices simultaneously and saves/unsaves happen concurrently? The most recent write wins outright — no merge or conflict prompt (FR-020).
- What happens when an unauthorized user repeatedly attempts to sign in? They should consistently see the invitation-only message rather than being granted access through retries.
- What happens to a user's saved data if their account is later removed from the authorized list? Saved data is retained (not deleted) so access can be restored if the account is re-authorized later; the user simply cannot reach it while unauthorized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require a signed-in, authenticated session before allowing any use of the extension's features, including generating a summary, chatting about a video, and viewing saved history.
- **FR-002**: System MUST support signing in exclusively via Google account authentication.
- **FR-003**: System MUST maintain a list of explicitly authorized Google accounts and MUST deny access to any account not on that list.
- **FR-004**: System MUST show a clear, plain-language message to users whose Google account is not authorized, communicating that access is invitation-only, without exposing any extension functionality to them.
- **FR-005**: System MUST allow the developer to add or remove authorized Google accounts at any time, with changes taking effect without publishing a new extension version and without redeploying the backend.
- **FR-006**: System MUST re-check a user's authorization status such that a revoked account loses access promptly (within the same session or on next action), not merely on their next fresh sign-in.
- **FR-006a**: System MUST keep a signed-in, authorized user's session active for up to 30 days without requiring interactive re-authentication, provided silent session renewal continues to succeed; when renewal fails (including after 30 days of inactivity), the user MUST be prompted to sign in again before regaining access.
- **FR-007**: System MUST allow a signed-in, authorized user to explicitly save a video's current summary and chat conversation as a distinct action, separate from simply viewing it.
- **FR-008**: System MUST persist saved summaries and chat histories indefinitely (i.e., not subject to browser-session expiry) until the user explicitly removes them.
- **FR-008a**: System MUST cap a saved video's persisted chat history at the most recent 50 messages, matching the existing live-session cap; when a save would exceed this, the oldest messages are dropped first rather than the save failing.
- **FR-009**: System MUST continue to treat unsaved videos exactly as today: their summary and chat live only for the current browser session and are cleared when the browser closes.
- **FR-010**: System MUST scope all saved data strictly to the signed-in user's account, such that no user can view or restore another user's saved videos.
- **FR-011**: System MUST make a user's saved videos, summaries, and chat histories available whenever that same Google account signs in, regardless of device or browser.
- **FR-012**: System MUST provide a "Saved" view listing all of a signed-in user's saved videos, showing enough identifying information for the user to recognize each one (e.g., title).
- **FR-013**: System MUST allow a user to select a saved video from the Saved view and fully restore its summary and complete chat history for continued viewing/chatting.
- **FR-014**: System MUST allow a user to remove (unsave) a previously saved video, after which it no longer appears in their Saved view.
- **FR-015**: System MUST continue persisting new chat messages added after a video was saved as part of that video's saved chat history.
- **FR-016**: System MUST indicate, when a user is viewing a video they have already saved, that it is saved (rather than presenting it as unsaved).
- **FR-017**: System MUST present a clear empty state in the Saved view when a user has not yet saved any videos.
- **FR-018**: System MUST handle a failed save attempt by informing the user the save did not complete, without leaving the video in an inconsistent state.
- **FR-019**: System MUST cap the number of videos a single user can have saved at once at 200; when a user at the cap attempts to save an additional video, the system MUST reject the save with a clear message directing them to remove an existing saved video first.
- **FR-020**: System MUST resolve concurrent saves/updates to the same saved video from two devices signed in with the same account via last-write-wins (the most recent write overwrites the prior one) without merge logic or a conflict-resolution prompt.

### Key Entities

- **User Account**: Represents an authenticated individual, identified by their Google account. Tracks authorization status (authorized vs. not) and owns zero or more Saved Videos.
- **Authorized User List**: The developer-managed set of Google accounts permitted to use the extension. Independent of extension deployment; changes apply live.
- **Saved Video**: A video a user has explicitly chosen to persist. Includes the video's identity (e.g., title, channel, source link), its summary content, and its chat history. Owned by exactly one User Account; persists indefinitely until removed by that user. A single account may own at most 200 Saved Videos at once (FR-019).
- **Chat History**: An ordered sequence of chat messages exchanged about a specific video, capped at the most recent 50 messages once saved (FR-008a). Exists transiently for unsaved videos (session-scoped) and durably for Saved Videos (persisted, appendable after saving).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of extension features (summary generation, chat, saved history) are inaccessible to any user who has not completed sign-in.
- **SC-002**: 100% of sign-in attempts from Google accounts not on the authorized list result in the invitation-only message and no feature access, with zero exceptions.
- **SC-003**: A user can save a video's summary and chat, close and fully quit their browser, reopen it, sign in, and find that saved content restored with 100% fidelity — identical summary text and identical chat message history up to the 50-message saved cap (FR-008a).
- **SC-004**: A user can access their previously saved videos from a different device/browser after signing in with the same account, with the same content available there within a few seconds of opening the Saved view.
- **SC-005**: The developer can grant or revoke access for a Google account and have that decision take effect for the affected user without any new extension release or backend redeployment being required.
- **SC-006**: Saving a video is never triggered automatically; across normal usage, only videos a user explicitly marks as saved appear in their Saved view.
- **SC-007**: Users can locate and restore any of their saved videos from the Saved view in a small, bounded number of interactions (e.g., open Saved view, select the video).
- **SC-008**: A signed-in, authorized user who returns within 30 days is not asked to interactively re-authenticate, provided silent session renewal succeeds.

## Assumptions

- Google is the sole supported sign-in method for this feature; no other identity providers (email/password, other OAuth providers) are in scope.
- The developer manages the authorized-account list through some form of configuration or admin mechanism that is external to the extension's shipped code and the backend's deployed artifact — the specific mechanism is an implementation detail decided during planning, not this specification.
- "Persists indefinitely" means saved data is retained until the user explicitly unsaves it; it is not automatically expired or purged by the system.
- Saved data belonging to a user whose authorization is later revoked is retained (not deleted) in case the developer re-authorizes them later; a fully separate data-deletion request is out of scope for this feature.
- The existing session-only behavior for unsaved videos (cleared on browser close) is unchanged by this feature and remains the default for any video the user does not explicitly save.
- Multi-device concurrent editing (Edge Cases) is expected to be rare; last-write-wins is now a firm requirement (FR-020), not merely a fallback assumption.
