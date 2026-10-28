# Google sign-in: conditional future desktop integration

## Current evidence (28 October 2026)

The screenshot supplied by the account owner identifies the journal's own dialog: it blocks `accounts.google.com.pk`. This is NOT evidence of Google rejecting the embedded browser. Version 0.2.5 corrects the regional account hostname allowlist. The user has requested a standalone app and has no TradersYard backend access; backend integration is not required to fix this observed error.

The design below is retained only as a conditional future option if an actual provider-level embedded-browser rejection occurs. It is not the diagnosis or required solution for the supplied screenshot.

The journal currently opens the official TradersYard login inside an Electron BrowserWindow. The observed Google flow returns to TradersYard's HTTPS callback at `/auth/social/google/callback`. It does not return an application authorization grant to the journal. The account API currently uses the isolated Electron session.

Google's OAuth policy disallows embedded user agents under an app developer's control. Its desktop guidance requires the system browser and an appropriate redirect flow. A new desktop Google client by itself would authenticate a Google identity; it would not authorize that identity to read a TradersYard user's accounts.

Sources:
- https://developers.google.com/identity/protocols/oauth2/policies#use_secure_browsers
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://www.rfc-editor.org/rfc/rfc8252

## Preferred path for the intended TradersYard dashboard

Mount the existing `dist-embed` journal module after the dashboard's normal login, using the identity and adapter contract in `INTEGRATION.md`. The site's Google login then runs in the user's ordinary browser. The journal does not implement a second sign-in or copy browser cookies.

The TradersYard backend must authenticate the existing session, authorize account ownership on every request, persist journal state by user, and expose the required read-only account/trade/rule data through the adapter. The embedded module already accepts that adapter; the dashboard/backend implementation and staging verification are not present in this workspace.

## If a standalone Windows app must support Google

TradersYard must support a first-party desktop authorization flow. Use its supported OAuth/OIDC authorization-code flow with PKCE if one is available. Otherwise its team must implement and review an equivalent authorization handoff. The following is a proposed contract, not a claim that these endpoints already exist:

1. Register a public Journal client with read-only journal/account scopes. Do not distribute a client secret in the executable.
2. The desktop app creates a fresh state value and PKCE S256 challenge and opens the first-party authorization page in the system browser. The browser completes TradersYard's normal email/social login and the user approves the Journal connection.
3. TradersYard returns a short-lived, single-use authorization code to the registered redirect. A desktop loopback receiver must bind only to 127.0.0.1 on an ephemeral port, validate the exact callback path and state, and time out/cancel cleanly. The authorization server must validate the client's allowed redirect rules.
4. The desktop app exchanges the code and verifier directly with TradersYard over HTTPS. The server binds the code to the client, redirect and PKCE challenge, and rejects replay, expiry and mismatches.
5. TradersYard issues a revocable, least-privilege token for its read-only account API. The app stores refresh credentials in Windows-protected credential storage and keeps short-lived access credentials out of journal backups, logs, UI state and MCP tool responses. The token must identify the authenticated TradersYard user, not trust a client-supplied user/account ID.
6. Only a successful authenticated account API response changes the journal to Connected. Cancelled/failed login remains disconnected; disconnect revokes the grant and removes local credentials while preserving journal history.

Required inputs: the TradersYard dashboard/auth backend repository or official desktop authorization/API documentation; an authorized public client registration and staging environment; agreed token scopes and refresh/revocation behavior. Do not send secrets in chat.

## Acceptance tests before calling Google support complete

- Fresh Google sign-in, existing browser session, MFA, denial and cancellation.
- Wrong/missing state, incorrect verifier, duplicate callback, expired/replayed code and redirect mismatch.
- Concurrent/restarted attempts, app closed during login, browser unavailable and network failure.
- Correct user/account isolation, expired/revoked token, reconnect and disconnect.
- Login window closure, account sync and persistence from an installed copy on another Windows user/device.

Opening the website in a normal browser without this handoff is not a desktop connection. Do not spoof the browser identity, weaken web security or copy browser cookies to work around a provider rejection.
