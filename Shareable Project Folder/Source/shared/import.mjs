import Papa from "papaparse";
import { validateTrade } from "./model.mjs";
const names = {
  externalId: ["trade_id", "id", "ticket", "tradeid"],
  symbol: ["symbol", "instrument", "ticker"],
  side: ["side", "direction", "type"],
  quantity: ["quantity", "qty", "volume", "size"],
  entryPrice: ["entry_price", "entryprice", "open_price"],
  exitPrice: ["exit_price", "exitprice", "close_price"],
  openedAt: ["opened_at", "open_time", "entry_time", "opentime"],
  closedAt: ["closed_at", "close_time", "exit_time", "closetime"],
  grossPnl: ["gross_pnl", "grosspnl", "profit", "pnl"],
  fees: ["fees", "commission", "commissions"],
  initialRisk: ["initial_risk", "risk"],
  strategy: ["strategy", "setup"],
  notes: ["notes", "comment"],
};
const norm = (k) =>
  k
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};
export function parseTradeCSV(csv, account, accounts) {
  const p = Papa.parse(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: norm,
  });
  if (p.errors.length) throw Error(`CSV: ${p.errors[0].message}`);
  const rejected = [],
    trades = [];
  p.data.forEach((row, index) => {
    try {
      const t = {};
      for (const [key, aliases] of Object.entries(names)) {
        const found = aliases.find((n) => Object.hasOwn(row, n));
        if (found) t[key] = row[found];
      }
      for (const key of [
        "quantity",
        "entryPrice",
        "exitPrice",
        "grossPnl",
        "fees",
        "initialRisk",
      ]) {
        if (t[key] !== undefined && t[key] !== "") {
          const cleaned = String(t[key]).replace(/[$,]/g, "");
          t[key] = Number(cleaned);
        } else if (["fees", "initialRisk"].includes(key)) t[key] = 0;
      }
      if (!t.openedAt || !/(Z|[+-]\d\d:\d\d)$/.test(t.openedAt))
        throw Error("Entry timestamp must include a timezone (Z or ±HH:MM).");
      if (t.closedAt && !/(Z|[+-]\d\d:\d\d)$/.test(t.closedAt))
        throw Error("Exit timestamp must include a timezone.");
      t.side = String(t.side || "").toLowerCase();
      t.side = ["buy", "long"].includes(t.side)
        ? "long"
        : ["sell", "short"].includes(t.side)
          ? "short"
          : t.side;
      t.status = t.closedAt ? "closed" : "open";
      t.accountId = account;
      t.source = "csv";
      t.tags = [];
      const identity =
        t.externalId ||
        hash(
          JSON.stringify([
            t.symbol,
            t.side,
            t.quantity,
            t.openedAt,
            t.entryPrice,
          ]),
        );
      t.id = `csv:${account}:${identity}`;
      trades.push(validateTrade(t, accounts));
    } catch (e) {
      rejected.push({ row: index + 2, error: e.message });
    }
  });
  return { trades, rejected, rows: p.data.length };
}
export function exportTradesCSV(trades) {
  const headers = [
    "trade_id",
    "symbol",
    "side",
    "quantity",
    "entry_price",
    "exit_price",
    "opened_at",
    "closed_at",
    "gross_pnl",
    "fees",
    "initial_risk",
    "strategy",
    "notes",
  ];
  const safe = (v) =>
    typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? `'${v}` : v;
  return Papa.unparse({
    fields: headers,
    data: trades.map((t) =>
      [
        t.id,
        t.symbol,
        t.side,
        t.quantity,
        t.entryPrice,
        t.exitPrice,
        t.openedAt,
        t.closedAt,
        t.grossPnl,
        t.fees,
        t.initialRisk,
        t.strategy,
        t.notes,
      ].map(safe),
    ),
  });
}
export function parseCandles(csv) {
  const p = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: norm,
  });
  if (p.errors.length) throw Error(p.errors[0].message);
  const candles = p.data
    .map((r, i) => {
      const c = {
        time: r.time || r.timestamp,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume || 0),
      };
      if (
        !/(Z|[+-]\d\d:\d\d)$/.test(c.time || "") ||
        !Number.isFinite(new Date(c.time).getTime()) ||
        !["open", "high", "low", "close", "volume"].every((k) =>
          Number.isFinite(c[k]),
        ) ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close) ||
        c.low > c.high
      )
        throw Error(
          `Invalid OHLC candle at row ${i + 2}. Use timezone-aware ISO timestamps.`,
        );
      return c;
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  if (new Set(candles.map((c) => c.time)).size !== candles.length)
    throw Error("Duplicate candle timestamps.");
  return candles;
}
