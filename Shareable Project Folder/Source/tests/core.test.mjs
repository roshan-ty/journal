import test from "node:test";
import assert from "node:assert/strict";
import {
  stats,
  net,
  dayKey,
  filterTrades,
  ruleProgress,
} from "../shared/analytics.mjs";
import {
  emptyState,
  mergeSnapshot,
  validateTrade,
  validateState,
} from "../shared/model.mjs";
import { parseTradeCSV, parseCandles } from "../shared/import.mjs";
import {
  normalizeAccount,
  normalizeProviderTrade,
  collectTradersYard,
} from "../shared/tradersyard.mjs";
import { closeSimulation, movingAverageBacktest } from "../shared/backtest.mjs";
const account = {
  id: "a",
  number: "A1",
  name: "Test",
  currency: "USD",
  status: "active",
};
const trade = (id, pnl, extra = {}) => ({
  id,
  accountId: "a",
  symbol: "ES",
  side: "long",
  status: "closed",
  quantity: 1,
  entryPrice: 6000,
  exitPrice: 6001,
  openedAt: "2026-10-01T10:00:00Z",
  closedAt: `2026-10-0${id}T12:00:00Z`,
  grossPnl: pnl,
  fees: 0,
  ...extra,
});
test("realized metrics account for fees, breakeven, R and drawdown", () => {
  const s = stats([
    trade("1", 110, { fees: 10, initialRisk: 50 }),
    trade("2", -50),
    trade("3", 0),
    trade("4", 20),
    trade("5", 900, { status: "open", unrealizedPnl: 30 }),
  ]);
  assert.equal(s.total, 70);
  assert.equal(s.winRate, 50);
  assert.equal(s.profitFactor, 2.4);
  assert.equal(s.expectancy, 17.5);
  assert.equal(s.maxDrawdown, 50);
  assert.equal(s.averageR, 2);
  assert.equal(s.unrealized, 30);
  assert.equal(s.openCount, 1);
});
test("zero/no-loss cases and missing marks are explicit", () => {
  assert.equal(stats([]).profitFactor, null);
  assert.equal(stats([trade("1", 2)]).profitFactor, Infinity);
  assert.equal(stats([trade("1", 2, { status: "open" })]).unrealized, null);
});
test("journal day boundaries use the selected timezone", () => {
  assert.equal(dayKey("2026-10-01T23:30:00Z", "Asia/Karachi"), "2026-10-02");
  assert.equal(
    dayKey("2026-10-01T23:30:00Z", "America/New_York"),
    "2026-10-01",
  );
});
test("combined journal never silently combines currencies", () => {
  const rows = [trade("1", 10), trade("2", 20, { accountId: "b" })];
  assert.equal(
    filterTrades(rows, {
      accounts: [account, { id: "b", currency: "EUR" }],
      currency: "USD",
    }).length,
    1,
  );
});
test("sync is idempotent and preserves review metadata", () => {
  const s = {
    ...emptyState(),
    accounts: [account],
    trades: [
      trade("1", 10, { notes: "Keep me", tags: ["calm"], reviewed: true }),
    ],
  };
  const snapshot = { accounts: [account], trades: [trade("1", 20)] };
  const once = mergeSnapshot(s, snapshot);
  assert.equal(once.added, 0);
  assert.equal(once.state.trades[0].notes, "Keep me");
  assert.equal(once.state.trades[0].grossPnl, 20);
  assert.equal(mergeSnapshot(once.state, snapshot).state.trades.length, 1);
});
test("only complete open snapshots remove stale provider positions", () => {
  const s = {
    ...emptyState(),
    accounts: [account],
    trades: [trade("1", 0, { status: "open", source: "tradersyard" })],
  };
  assert.equal(
    mergeSnapshot(s, { accounts: [], trades: [] }).state.trades.length,
    1,
  );
  assert.equal(
    mergeSnapshot(s, {
      accounts: [],
      trades: [],
      completedOpenAccountIds: ["a"],
    }).state.trades.length,
    0,
  );
});
test("malformed trades fail without storing a NaN", () => {
  assert.throws(() => validateTrade(trade("1", NaN), [account]));
  assert.throws(() =>
    validateTrade(trade("1", 10, { quantity: 0 }), [account]),
  );
  assert.throws(() =>
    validateTrade(trade("1", 10, { accountId: "missing" }), [account]),
  );
});
test("CSV supports quoted fields, stable IDs, and rejects ambiguous times", () => {
  const csv =
    'trade_id,symbol,side,quantity,entry_price,opened_at,closed_at,gross_pnl,fees,notes\nx,ES,buy,1,6000,2026-10-01T10:00:00Z,2026-10-01T11:00:00Z,100,4.2,"a,b"\ny,ES,long,1,6000,2026-10-01 10:00,2026-10-01T11:00:00Z,100,0,bad';
  const r = parseTradeCSV(csv, "a", [account]);
  assert.equal(r.trades.length, 1);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.trades[0].notes, "a,b");
  assert.equal(r.trades[0].id, "csv:a:x");
});
test("provider mapping keeps rule data and provider-reported P&L", () => {
  const a = normalizeAccount({
    tc_id: "TC-1",
    status: "in_risk_review",
    state: { cash_value: 10100, closed_profit_loss: 100 },
    current_level: {
      cash_value: 10000,
      rules: { consistency: { consistency_target: 40 } },
    },
  });
  assert.equal(a.status, "in-risk-review");
  assert.equal(a.rules.consistencyPercent, 40);
  const t = normalizeProviderTrade(
    {
      id: 1,
      instrument: "ES",
      originType: "long",
      volume: 2,
      lotSize: 1,
      price: 6000,
      avgExitPrice: 6001,
      createdDateTime: "2026-10-01T10:00:00Z",
      lastChangeDateTime: "2026-10-01T11:00:00Z",
      closedProfitLoss: 100,
    },
    "TC-1",
    "closed",
  );
  assert.equal(net({ ...t, fees: 50 }), 100);
  assert.equal(t.feesKnown, false);
});
test("provider collection paginates and retains per-account errors", async () => {
  const get = async (url) => {
    if (url.includes("?"))
      return {
        data: [
          {
            tc_id: url.includes("page=1") ? "TC-1" : "TC-2",
            status: "failed",
            current_level: {},
            state: {},
          },
        ],
        meta: { last_page: 2 },
      };
    if (url.endsWith("/open") || url.endsWith("/closed")) return { data: [] };
    if (url.endsWith("/stats")) throw Error("fixture unavailable");
    return { data: {} };
  };
  const s = await collectTradersYard(get);
  assert.equal(s.accounts.length, 2);
  assert.equal(s.completedOpenAccountIds.length, 2);
  assert.equal(s.issues.length, 2);
});
test("consistency is unknown when total profit is nonpositive", () => {
  const result = ruleProgress(
    { ...account, rules: { consistencyPercent: 40 } },
    [trade("1", -10)],
  );
  assert.equal(result.consistency, null);
  assert.equal(result.rules[0].passed, false);
});
test("OHLC validation and simulation honor direction, contract value and costs", () => {
  assert.throws(() =>
    parseCandles("time,open,high,low,close\n2026-10-01T00:00:00Z,10,9,8,10"),
  );
  const p = {
    side: "short",
    quantity: 2,
    entryPrice: 100,
    openedAt: "2026-10-01T10:00:00Z",
  };
  const t = closeSimulation(
    p,
    { close: 98, time: "2026-10-01T11:00:00Z" },
    50,
    2,
  );
  assert.equal(t.grossPnl, 200);
  assert.equal(net(t), 192);
  assert.throws(() =>
    closeSimulation(p, { close: 98, time: "2026-10-01T09:00:00Z" }, 50),
  );
});
