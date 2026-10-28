# Embedding TradersYard Journal

Version 0.3 separates the journal interface, domain calculations, persistence and TradersYard transport. TradersYard Journal displays every feature in one scrolling page without page-navigation tabs. Production dashboard integration requires your dashboard repository and authenticated backend; neither is changed by this project.

## Build and mount

Run `npm run build:embed`. Copy `dist-embed/tradersyard-journal.js` and `dist-embed/tradersyard-journal.css` into your application assets. The ES module contains React and the journal, and can mount inside Vue, React or a plain DOM element. Fonts and the logo are bundled. No CDN, model service or analytics endpoint is contacted.

```js
import {mountJournal} from './tradersyard-journal.js';
import './tradersyard-journal.css';

const journal = mountJournal(document.querySelector('#journal'), {
  identity: {id: authenticatedUser.id, name: authenticatedUser.displayName},
  theme: dashboardTheme,
  embedded: true,
  adapter: journalAdapter,
});

// Update when the dashboard switches theme.
journal.update({theme: 'light'});
// On sign-out or route teardown:
journal.unmount();
```

`JournalApp` is also a named React export. `src/adapter.d.ts` documents the host contract. The embedded view renders all 11 sections together, with no sidebar or page navigation. Account/date filters apply across the analytical sections; Coach deliberately retains all-account context. The standalone account-login header is hidden. All interface selectors are scoped below `.ty-journal`; it does not modify the host document title, body, root theme or localStorage. The example in `examples/embed.html` is an integration test with an empty, in-memory journal, not a demo workspace shipped to users.

## Adapter contract

- `load()` returns `{state, revision}`. State uses `schemaVersion: 1`; `shared/model.mjs` defines defaults and validation.
- `save(state, expectedRevision)` atomically rejects stale revisions and returns the saved `{state, revision}`. Never silently accept a last-writer-wins overwrite.
- `subscribe(listener)` optionally signals remote changes and returns an unsubscribe function. The journal reloads through `load()`.
- `sync()`, `retry()` and `connect()` are optional host actions. An already authenticated dashboard should use its existing session; it must not require a second login or expose provider cookies to the journal.
- `state.sync.connection` is `connected` or `disconnected`, independently of sync progress (`state.sync.status`). A temporary network/data error does not sign the user out. Expired authentication does. The desktop main process owns this value; hosts should likewise enforce it on their backend. `connect()` may return `{connected, message}`; authenticated `identity` suppresses the separate connection button.
- `disconnect()` and `exportBackup()` are optional. Omit any action that is inappropriate for your product flow.
- `coach(context)` optionally replaces the bundled script engine with host-owned inference. It returns `{text, facts?, sources?, language?}`. The context supplies source-linked knowledge, all-account analytical summaries, recent conversation and the requested language/script. Keep the system policy separate from untrusted user questions and saved guidance.

## User and data boundaries

The backend must derive the user from its existing authenticated session, authorize every account and trade, and partition state by that user. Never use a browser-provided identity as authorization. Replace the adapter and identity together when the authenticated user changes. The journal remounts on `identity.id`, clearing filters, forms and coach messages. Call `unmount()` on logout. The integration verification page exercises switching between two empty users and proves that their account lists are separate.

The Windows edition has one local journal per Windows user. Create Profile is a name for that local journal, not a second authentication system or multi-user account vault. Connecting TradersYard later merges synced records while preserving manual accounts, annotations and profile information.

## Provider integration

The standalone journal is maintained separately. The reported regional Google redirect issue was caused by its own hostname allowlist and does not require dashboard/backend changes. If a provider independently rejects embedded login in the future, [the external-browser integration note](research/GOOGLE-SIGN-IN-INTEGRATION.md) describes a possible first-party handoff. The dashboard embedding path below reuses the host's existing login.

In production, call the existing TradersYard account services from your backend or dashboard infrastructure and normalize snapshots with `shared/tradersyard.mjs`. Preserve account IDs, account numbers, status, currency, rule snapshots, authoritative P&L and timestamps. Use `mergeSnapshot` to retain journal notes/tags when trades update and to avoid removing open positions after an incomplete sync. Keep immutable provider fields separate from editable journal metadata. The current Electron transport and MCP must remain desktop-only; the embedding bundle imports neither.

Account-specific rules are authoritative. Historical plans may differ from the current public guides. Money from different currencies stays in separate totals; no exchange rates are invented. Yard Coach deliberately uses all accounts and all stored dates, independently of page filters.

## Incremental sync

Version 0.3.1 supports `collectTradersYard(getJson, {existing, refreshHistory, onSnapshot, onProgress})`. Persist each `onSnapshot(partial, progress)` with `mergeSnapshot` against the latest saved revision so accounts and complete trade batches appear before slower rule requests finish. Do not overwrite user annotations with a stale copy of the state. Only a complete, validated open-position response may supply `completedOpenAccountIds`; an error is never an empty position list.

`state.sync.progress` contains `{phase, completed, total}`. Phases are `accounts`, `trades` and `rules`; the progress bar describes the current phase, not an estimated total duration. Publish persistence changes through the adapter's `subscribe` callback. The desktop implementation in `electron/sync.cjs` also preserves completed batches after errors, prevents simultaneous sync jobs, and cancels writes after disconnect. Its transport retries a transient request once and respects rate limits.

Automatic refresh updates active or changed accounts and resumes incomplete history. Archived, unchanged accounts reuse completed history and static rule definitions. An explicit full sync refreshes everything. This behavior is shared by both desktop editions; a website integration should implement equivalent persistence and throttling in its own authenticated backend.

## Integration acceptance

Test backend authorization, concurrent saves, pagination and rate limits against your own staging environment before production integration. Current checks cover the library in a separate host shell, scoped CSS, host-controlled dark/light themes, identity switching, manual account entry and preservation of the existing desktop journal. This is an integration seam and tested library; it is not a deployment into TradersYard’s production dashboard.
