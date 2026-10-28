# TradersYard Journal source

Node.js 24 LTS is required for development. Run `npm ci`, `npm test`, `npm run build`, `npm run build:mcp`, then `npm start`. Use `npm run build:embed` for the dashboard library and `npm run dist` on Windows for an installer.

See `../README.md` for the complete handoff guide and `INTEGRATION.md` for the authenticated dashboard adapter. This source is the single-page TradersYard edition. `product.json` controls its identity and data locations. All runtime dependencies are bundled; no node_modules tree is installed on end-user devices. Test fixtures are synthetic and live only in the source/test environment.
