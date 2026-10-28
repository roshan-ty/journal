import product from '../product.json' with {type:'json'};
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import os from "node:os";
import metadata from '../package.json' with {type:'json'};
import {openStore} from '../electron/store.cjs';
import { filterTrades, stats, ruleProgress } from "../shared/analytics.mjs";
const dir =
  process.env[product.dataEnvironment] ||
  path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    product.dataDirectory,
  );
const store = openStore(dir),
  server = new McpServer({ name: product.id, version: metadata.version });
const answer = (value) => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(
        value,
        (_key, v) => (v === Infinity ? "Infinity (no losing trades)" : v),
        2,
      ),
    },
  ],
});
const read = () => {
  const r = store.read();
  if (!r)
    throw Error(`Open ${product.name} first to initialize your workspace.`);
  return r.state;
};
const selection = {
  accountId: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  currency: z.string().optional(),
};
const selected = (s, a) =>
  filterTrades(s.trades, {
    accounts: s.accounts,
    account: a.accountId || "all",
    from: a.from,
    to: a.to,
    timezone: s.settings.timezone,
    currency: a.currency || s.settings.currency,
  });
const register = (name, description, inputSchema, fn, readOnly = true) =>
  server.registerTool(
    name,
    {
      description,
      inputSchema,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: false,
        idempotentHint: readOnly,
        openWorldHint: !readOnly,
      },
    },
    async (a) => {
      try {
        return answer(await fn(a));
      } catch (e) {
        return { ...answer({ error: e.message }), isError: true };
      }
    },
  );
register(
  "journal_list_accounts",
  "List local journal accounts, unique numbers, currencies and latest provider status. No credentials are returned.",
  {},
  () => {
    const s = read();
    return {
      accounts: s.accounts.map(({ providerRuleStatus, ...a }) => a),
      sync: s.sync,
    };
  },
);
register(
  "journal_get_trades",
  "Read a bounded page of trades from a single account or combined currency-filtered journal.",
  {
    ...selection,
    status: z.enum(["open", "closed"]).optional(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(200).default(50),
  },
  (a) => {
    const s = read();
    const rows = selected(s, a)
      .filter((t) => !a.status || t.status === a.status)
      .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
    return {
      total: rows.length,
      offset: a.offset,
      trades: rows
        .slice(a.offset, a.offset + a.limit)
        .map(({ attachments, ...t }) => ({
          ...t,
          attachmentCount: attachments?.length || 0,
        })),
      nextOffset: a.offset + a.limit < rows.length ? a.offset + a.limit : null,
    };
  },
);
register(
  "journal_get_metrics",
  "Compute realized P&L, win rate, expectancy, profit factor, equity/drawdown and calendar data. Open marks are reported separately.",
  selection,
  (a) => {
    const s = read();
    return {
      currency: a.currency || s.settings.currency,
      timezone: s.settings.timezone,
      metrics: stats(selected(s, a), s.settings.timezone),
      sync: s.sync,
    };
  },
);
register(
  "journal_get_rules",
  "Read provider rule snapshots and locally calculated progress for one account. Provider snapshots take precedence; missing data remains unknown.",
  { accountId: z.string() },
  (a) => {
    const s = read(),
      account = s.accounts.find((x) => x.id === a.accountId);
    if (!account) throw Error("Account not found.");
    return {
      accountNumber: account.number,
      status: account.status,
      syncedAt: account.syncedAt,
      progress: ruleProgress(account, s.trades, s.settings.timezone),
    };
  },
);
for (const kind of ["connect", "sync"])
  register(
    `tradersyard_${kind}`,
    kind === "connect"
      ? "Ask the running desktop app to open official TradersYard sign-in. User completes login. No passwords are collected by this MCP."
      : "Ask the running desktop app to refresh accounts, trades and provider rule snapshots using its existing authenticated session.",
    kind === 'sync' ? {retryIncomplete:z.boolean().default(false)} : {},
    (args) => {
      const r = store.db
        .prepare("INSERT INTO commands(kind,created_at) VALUES(?,?)")
        .run(kind === 'sync' && args.retryIncomplete ? 'retry' : kind, new Date().toISOString());
      return {
        requestId: Number(r.lastInsertRowid),
        status: "pending",
        message:
          "Keep the Windows journal open. Read journal_request_status for completion.",
      };
    },
    false,
  );
register(
  "journal_request_status",
  "Read status of a requested connection or sync.",
  { requestId: z.number().int().positive() },
  (a) => {
    const row = store.db
      .prepare(
        "SELECT id,kind,status,result,created_at FROM commands WHERE id=?",
      )
      .get(a.requestId);
    if (!row) throw Error("Request not found.");
    return { ...row, result: row.result ? JSON.parse(row.result) : null };
  },
);
register(
  "journal_sync_status",
  "Read latest sync time, coverage and actionable issues.",
  {},
  () => read().sync,
);
server.connect(new StdioServerTransport()).catch(error => {console.error(error.message);store.close();process.exit(1);});
process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});
