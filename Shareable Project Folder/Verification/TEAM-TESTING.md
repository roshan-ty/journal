# Team installation — Journal editions 0.3.1

Share the setup.exe in the requested product's `Setup File` folder. The two installers are independent and can coexist on one Windows x64 device. Each includes the complete app, Chromium runtime, local database support, scripted Coach, typography, icons and optional MCP service. No Node.js, Python, external browser or AI subscription must be installed separately. Internet is needed for TradersYard sign-in and sync.

Setup requests administrator approval and defaults to `C:\Program Files\TradersYard Journal` or `C:\Program Files\Bulls & Bears Journal`. It allows a different destination, offers a desktop shortcut checkbox, and creates a Start menu entry. Optional taskbar instructions are on the final page; Windows requires the user to choose Pin to taskbar from the running app's icon.

The sibling `Production Ready App` folder is the complete runnable runtime payload. Keep the executable beside its DLL/PAK/BIN files, `locales` and `resources`. These are required files. Setup adds an uninstaller and Windows registration/shortcuts at install time. The installed `READ ME.txt` describes the layout and data locations.

The two applications use different journals and sign-in sessions. Existing TradersYard Journal data is retained when updating. Bulls & Bears starts with Connect Account or Create Profile, and does not copy the other app's accounts or credentials. Do not distribute personal AppData folders or journal backups.

## Acceptance checks

- App opens maximized with the right name and icon.
- TradersYard displays all features on one scrolling page; Bulls & Bears retains sidebar pages and adds Partners.
- White logos remain visible in both themes. Account selector width stays aligned when opened.
- Create a manual profile/account/trade, restart, and confirm persistence.
- Connect to TradersYard using the user's preferred official sign-in method. Successful verification closes the sign-in window. Test account discovery, refresh, rules and historical trades.
- Check account-specific and same-currency combined analytics, filters, calendar and report grouping.
- Open Coach; verify its responses use all accounts rather than the selected reporting filter.
- Bulls & Bears Partners copies RSHN and opens the supplied referral URL. Discounts and eligibility are confirmed at checkout; no purchase is needed for testing.
- Export a private backup and confirm the expected data is present. Keep it off shared channels.

## Optional MCP client

Use the installed app executable as `command`, its `resources/mcp/server.cjs` as the argument, and set `ELECTRON_RUN_AS_NODE=1`. This uses the included runtime. Both editions expose the same eight journal/provider tools but read their own data folders. The app must be running to process queued connection or sync requests. Do not configure this financial-data access in clients that the user does not trust.

## Scope

These builds are unsigned internal team releases. The regression suite and packaged runtime checks pass on the development PC; a fresh elevated installation of 0.3.1 on a separate Windows device has not been performed. Every identity provider/device combination is not guaranteed. Coach remains a bounded scripted knowledge engine, and the included replay uses user-supplied OHLC data. The TradersYard dashboard library requires the team's authenticated persistence adapter before deployment into its website.

