# TradersYard Journal 0.3.1 — team handoff

This folder contains the single-page TradersYard edition, its complete Windows runtime, installer, dashboard library and reproducible development source. The Bulls & Bears edition remains a separate product and installer outside this folder.

| Folder | Purpose |
| --- | --- |
| `Setup File/setup.exe` | Install the self-contained Windows x64 application. |
| `Production Ready App/` | Run `TradersYard Journal.exe` directly; keep all adjacent files together. |
| `Dashboard Integration/` | Ready-built ES module, scoped CSS, host example and adapter contract. |
| `Source/` | Frontend, shared calculations/connector, Electron backend, MCP, knowledge, assets, tests, build scripts and dependency lockfile. |
| `Verification/` | Release checks, installation-payload comparison and SHA-256 file manifest. |

The installer includes Electron/Chromium, database support, fonts, logos, the scripted Yard Coach and optional MCP. End users do not need Node.js, Python or a separate AI service. Internet is required for TradersYard sign-in and synchronization. Setup defaults to Program Files, offers a desktop shortcut, and provides optional instructions for Windows taskbar pinning. It adds the uninstaller and Windows registration during installation. User data is stored separately in the Windows user profile.

## Develop

Install Node.js 24 LTS and npm on the development machine, open a terminal in `Source`, then run:

```powershell
npm ci
npm test
npm run build
npm run build:mcp
npm start
```

`npm run dev` serves the browser development interface. `npm run build:embed` builds the dashboard module. On Windows, `npm run dist` creates the NSIS installer and portable executable in `Source/release`. Dependencies are locked in `package-lock.json` and downloaded by `npm ci`; dependency trees and build caches are deliberately not copied into this handoff. REA was a research tool and is not needed to run or build the journal.

## Add a Journal tab to the website

Read `Dashboard Integration/INTEGRATION.md` and `adapter.d.ts`. Import `tradersyard-journal.js` and its CSS, then call `mountJournal(element, {identity, adapter, theme, embedded: true})` inside the dashboard's Journal tab. All 11 journal sections appear on one scrolling page. The existing dashboard session supplies identity; the journal does not ask for another login.

Implement the adapter against your authenticated backend: `load`, revision-checked `save`, optional `subscribe`, and optional `sync`/`retry`. Authorize every account on the server and partition state by authenticated user. `Source/shared/model.mjs` and `tradersyard.mjs` define validation, merging and provider normalization. Do not copy the desktop sign-in session or Electron transport into a web page. Unmount the journal on logout and replace identity and adapter together when users change.

To view the empty, in-memory host example, from `Source` run:

```powershell
node scripts/serve-check.mjs "../Dashboard Integration" 5174
```

Then open `http://127.0.0.1:5174/example.html`. This example demonstrates themes and user isolation; it is not a production authentication or storage backend.

## Scope and validation

Version 0.3.1 streams accounts and completed trade batches into the journal, preserves downloaded data on later errors, retries transient failures once, and caches completed archived history. It reduces repeated analytics work and loads raw rule details only when expanded. `Verification` records the checks performed for this build.

The builds are unsigned internal team releases. The website adapter still needs implementation and staging tests in TradersYard's own dashboard. Yard Coach is a bounded script/knowledge engine, not a general-purpose trained language model. Replay uses user-provided OHLC data. Feature boundaries are documented in `Source/research/FEATURE_COVERAGE.md`.

No personal journal, credentials, sign-in session, private trade export or development machine cache is included. Do not add AppData folders or personal backups when forwarding this folder.
