import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProviderTrade,
  collectTradersYard,
} from "../shared/tradersyard.mjs";
import {
  mergeSnapshot,
  emptyState,
  validateState,
  validateTrade,
} from "../shared/model.mjs";
import { ruleProgress, stats } from "../shared/analytics.mjs";
import { exportTradesCSV, parseTradeCSV } from "../shared/import.mjs";

const raw = {
  id: "ES",
  instrument: "ES",
  originType: "long",
  type: "long",
  volume: 1,
  quantity: 1,
  lotSize: 1,
  entryPrice: 100,
  price: 102,
  avgExitPrice: 104,
  createdDateTime: "2026-10-01T10:00:00.000Z",
  lastChangeDateTime: "2026-10-01T11:00:00.000Z",
  closedProfitLoss: 100,
  openProfitLoss: 25,
};
const account = {
  id: "ty:TC-1",
  number: "TC-1",
  currency: "USD",
  source: "tradersyard",
};
test("instrument IDs cannot collapse separate closed trades, and averages match the provider table", () => {
  const a = normalizeProviderTrade(raw, "TC-1", "closed");
  const b = normalizeProviderTrade(
    {
      ...raw,
      createdDateTime: "2026-10-02T10:00:00Z",
      lastChangeDateTime: "2026-10-02T11:00:00Z",
    },
    "TC-1",
    "closed",
  );
  assert.notEqual(a.id, b.id);
  assert.equal(a.entryPrice, 102);
  assert.equal(a.firstEntryPrice, 100);
  const snapshot = {
    accounts: [account],
    trades: [a, b],
    completedClosedAccountIds: [account.id],
  };
  const once = mergeSnapshot(emptyState(), snapshot).state;
  assert.equal(once.trades.length, 2);
  assert.equal(mergeSnapshot(once, snapshot).state.trades.length, 2);
  assert.equal(
    parseTradeCSV(exportTradesCSV(once.trades), account.id, [account]).trades
      .length,
    2,
  );
});
test("identical source identities preserve every returned row with stable occurrence keys", async () => {
  const get = async (url) =>
    url.includes("?")
      ? { data: [{ tc_id: "TC-1", status: "active" }] }
      : url.endsWith("/closed")
        ? { data: [raw, raw] }
        : url.endsWith("/open")
          ? { data: [] }
          : { data: {} };
  const snapshot = await collectTradersYard(get);
  assert.equal(new Set(snapshot.trades.map((t) => t.id)).size, 2);
});
test("open position notes follow the position into closed history", () => {
  const opened = {
    ...normalizeProviderTrade(raw, "TC-1", "open"),
    notes: "Review this entry",
    reviewed: true,
  };
  const closed = normalizeProviderTrade(raw, "TC-1", "closed");
  const next = mergeSnapshot(
    { ...emptyState(), accounts: [account], trades: [opened] },
    {
      accounts: [account],
      trades: [closed],
      completedOpenAccountIds: [account.id],
    },
  ).state;
  assert.equal(next.trades.length, 1);
  assert.equal(next.trades[0].notes, "Review this entry");
});
test("provider rule progress takes precedence over incomplete local history", () => {
  const a = {
    ...account,
    providerClosedPnl: 500,
    rules: { profitTarget: 1000, profitableDays: 6, consistencyPercent: 40 },
    providerRuleStatus: {
      stats: {
        profitable_days_count: 4,
        consistency: 35,
        consistency_target_reached: true,
      },
    },
  };
  const result = ruleProgress(a, []);
  assert.equal(result.rules.find((r) => r.name === "Profitable days").value, 4);
  assert.equal(result.rules[0].value, 500);
  assert.equal(result.rules[1].passed, true);
  assert.equal(
    stats([normalizeProviderTrade(raw, "TC-1", "closed")]).feesUnknownCount,
    1,
  );
});
test("bad backup preferences and ambiguous manual timestamps cannot poison the saved workspace", () => {
  assert.throws(() =>
    validateState({ ...emptyState(), settings: { timezone: "not-a-zone" } }),
  );
  assert.throws(() => validateState({ ...emptyState(), notes: {} }));
  const trade = normalizeProviderTrade(raw, "TC-1", "closed");
  assert.throws(() =>
    validateTrade({ ...trade, openedAt: "2026-10-01 10:00" }, [account]),
  );
});
