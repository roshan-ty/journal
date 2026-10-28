# Journal 0.3.1 verification

Windows x64, 28 October 2026. Both editions share the same synchronization and calculation code.

## Loading and reliability

The previous collector waited until every account's history and rule requests finished before committing a snapshot. A slow request could leave a newly connected journal looking empty. The revised collector commits account pages immediately, followed by complete trade batches, then rule details. It merges against the latest saved revision so edits made during synchronization survive. Completed batches remain available after later failures; incomplete open-position responses cannot remove saved positions.

Transient network/server failures retry once. Authentication failures end the job, and rate limiting preserves completed results and stops the request sequence. Background refresh resumes incomplete history, updates active/changed accounts, reuses completed archived history and static definitions, and retries outstanding endpoint issues. Explicit full sync remains available. The global status banner shows the current phase and retry action.

Rendering retains unchanged collection references, memoizes filtering/sorting and per-account analytics, and expands raw rule JSON only when requested. Synchronization makes one backup checkpoint per job instead of one per progress update. The desktop closes its SQLite connection during shutdown.

## Automated and live checks

- All 61 regression tests passed separately in both product configurations. Nine new checks cover partial persistence, edits during sync, resumed archived history, targeted retry, incomplete open responses, rate limiting, cancellation, transient retries and render-reference reuse.
- Production frontend, embedded TradersYard module/CSS and MCP builds succeeded.
- The handoff source lockfile was regenerated without the research-only REA dependency. A separate offline `npm ci --ignore-scripts` installed 456 cached packages in the handoff source; all 61 tests and the frontend, embed and MCP builds passed from that copy. Temporary dependencies and test caches were then moved outside the shareable folder. Developers should use normal `npm ci` so Electron's runtime download/install script runs.
- In the packaged Bulls & Bears app, the saved official connection was reused. Accounts and trades appeared before rule collection finished. The full live collection completed with no endpoint issues and the journal remained saved after closing the app. Personal record contents are not included in this handoff.
- Both final delivered applications reopened their existing journals and completed refresh with connected status and no reported endpoint issues. The Bulls & Bears close/reopen check retained the account and trade counts.
- A subsequent archived-account refresh required only the two account-list pages, completed in approximately 6.3 seconds on this connection, and reported no endpoint issues. This is one observed workspace, not a response-time guarantee.
- Packaged MCP checks in both editions initialized the stdio protocol, listed eight tools and read a synthetic account using the included Electron/Node runtime.

## Interface

- TradersYard displayed all 11 sections on one page, no sidebar, visible sync progress, and an aligned dark-mode account dropdown. The checked viewport had no horizontal page overflow.
- Bulls & Bears retained the sidebar and Coach. Partners displayed only Feefo, a 4.7/5 product rating, partially filled five-star visual, checked date, and direct merchant review link. The card was visually checked in dark/light themes and at a 560px window width without horizontal overflow. Trustpilot was removed.
- Feefo source: https://www.feefo.com/en-GB/reviews/tradersyard, checked 28 October 2026. The rating is a dated display value, not a live feed.
- Both tested browser interfaces had no captured JavaScript errors.
- The exact delivered dashboard example rendered all 11 sections, accepted a host theme change without changing the host background, had no sidebar or horizontal overflow, and reported no captured JavaScript errors.

## Packages and handoff

The corresponding installer-payload reports compare every runtime file by SHA-256 against the extracted setup. Release verification checks the packaged backend, UI assets, metadata and bundled MCP and rejects development/private files. Delivery manifests verify the final copies. The shareable project verifier checks that its runtime/setup match the TradersYard release and rejects database files, sign-in session files, dependency trees and caches.

`Shareable Project Folder` contains the TradersYard installer, complete runtime, compiled dashboard module, full application source, dependency lockfile, synthetic tests and integration instructions. It excludes personal journals, credentials, sign-in profiles, research captures and build caches.

## Remaining limits

These are unsigned internal team builds. An elevated installation on a separate clean Windows PC has not been performed for 0.3.1. The existing installer layout and options are retained. Every identity provider, device and provider account type is not guaranteed. Yard Coach remains a bounded scripted knowledge engine. The website module still requires TradersYard's authenticated backend adapter and staging verification; no dashboard production deployment is claimed.
