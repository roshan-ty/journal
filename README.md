# journal

TradersYard Journal 0.3.1 — a single-page trading journal and dashboard integration package.

## Downloads for the team

- [Windows installer — setup.exe](https://github.com/roshan-ty/journal/releases/download/v0.3.1/setup.exe)
- [Complete Shareable Project Folder ZIP](https://github.com/roshan-ty/journal/releases/download/v0.3.1/TradersYard-Journal-0.3.1-Shareable-Project.zip) — full application, installer, source, compiled dashboard module and verification files.
- [Release notes and SHA-256 checksums](https://github.com/roshan-ty/journal/releases/tag/v0.3.1)

The installer and application executable exceed GitHub's normal per-file limit. Their complete, unchanged files are distributed through **Releases**. The repository contains the development and integration files under [Shareable Project Folder](Shareable%20Project%20Folder); its application/setup folders link to the release downloads. GitHub's **Code → Download ZIP** contains the repository files, so use the complete release ZIP above when you need the Windows application too. Git LFS is not required.

## Development

Open [Source](Shareable%20Project%20Folder/Source) with Node.js 24 LTS installed:

```powershell
cd "Shareable Project Folder/Source"
npm ci
npm test
npm run build
npm run build:mcp
npm start
```

Use `npm run dev` for browser development, `npm run build:embed` for the dashboard module, and `npm run dist` on Windows for the installer and portable executable.

## TradersYard dashboard integration

Read the [integration guide](Shareable%20Project%20Folder/Dashboard%20Integration/INTEGRATION.md) and [adapter contract](Shareable%20Project%20Folder/Dashboard%20Integration/adapter.d.ts). Mount the module inside the dashboard's Journal tab with the authenticated user's identity, persistence adapter and theme. All 11 sections appear on one scrolling page. The team must connect the adapter to its authorized backend; the desktop sign-in transport is not used inside the website.

The [team handoff guide](Shareable%20Project%20Folder/README.md) explains the package layout, build commands and integration example. [Verification](Shareable%20Project%20Folder/Verification/VERIFICATION-v0.3.1.md) records the checks and limitations.

## Release scope

This repository contains the **TradersYard** edition. Bulls & Bears Journal is a separate application and is not included here. The Windows builds are unsigned internal team releases. The installer includes the required runtime and optional MCP; end users do not need Node.js or Python. Yard Coach is a bounded scripted knowledge engine. Personal journals, sign-in sessions, credentials, dependency trees and caches are excluded.
