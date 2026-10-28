# Feature coverage and remaining work

Observed 27 October 2026. Public TradeZella documentation and shipped public JavaScript were inspected. There is no authenticated TradeZella account available, so private-screen parity and every product entitlement cannot be verified.

| Area | Implemented | Remaining limitation |
|---|---|---|
| Journal and accounts | Per-account/combined views, manual accounts, currency-safe filters, provider statuses | One local Windows workspace, not hosted multi-user SaaS |
| TradersYard connection | Official login, isolated saved session, read-only challenge/funded account API collection, pagination, throttling, error reporting | Unofficial versioned endpoints may change; every OAuth method and competition/tournament portfolio is not verified |
| Trade data | Open/closed analytics rows, unique composite identities, raw source data, notes preserved during updates | Full fill-level ledger, historical corrections and API retention are not guaranteed |
| P&L and analytics | Win rate, profit factor, expectancy, average win/loss/R, streaks, best/worst, equity/drawdown, open marks | Separate commission data, MFE/MAE and intraday marked equity require more source data |
| Rule tracking | Provider snapshots, profit targets, profitable days, consistency and drawdown remaining | Provider snapshots are authoritative; arbitrary rule schemas remain visible as raw records |
| Calendar and reports | Daily calendar, day detail, symbol/strategy/side/day/hour reports | TradeZella's complete report catalog and custom widget builder are not replicated |
| Reviews | Notes, tags, screenshots, rating, risk, reviewed state | No video attachments or cloud-sharing links |
| Notebook / strategies | Templates, saved notes, strategy rules and performance | No shared notebooks or multi-user permissions |
| Progress | Daily habit checklist and custom habits | No externally synced goals or coaching assignments |
| Replay / backtesting | OHLC import, candle playback, simulated trades, saved sessions, MA crossover script | No bundled market feed, tick/order-book/Level 2 replay, drawing toolkit, spread/slippage/liquidity model or full strategy scripting editor |
| Coach | All-account analysis, verified company/rule knowledge, Roman Urdu/Hindi explanations, translated metrics/review plans and custom guidance | Bounded scripts, not trained model weights; complete translation and arbitrary questions require a model |
| Dashboard embedding | Host adapter, user identity remount, scoped CSS, host theme and independent ES bundle | Host backend authorization and production integration still belong to TradersYard |
| Broker imports | TradersYard auto-sync and generic CSV mapping | TradeZella's full broker integration catalog is not implemented |
| Mentor/community | Local export files can be shared manually | No hosted mentor review, community, comments or permissions |
| Windows delivery | Electron app, installer, portable build, custom icons, dark/light themes | Unsigned; no auto-update hosting or cross-platform release testing |
| MCP | Eight stdio tools with actual SDK protocol tests | Client configuration remains explicit; not a remote hosted MCP |

## Evidence needed for further parity

An authenticated TradeZella walkthrough (or recordings supplied by an authorized user) is needed to compare private screens and edge cases. Licensed market data is needed for built-in historical tick/Level 2 replay. A local model and suitable hardware would be needed to add an actual offline language model; custom scripts and guidance alone do not train one. Hosted multi-user functions require infrastructure and an authentication/authorization design beyond this local application.

The shipped UI uses original implementation and TradersYard Journal branding. TradeZella's JavaScript and charting library were analyzed as evidence, not incorporated in the application.
