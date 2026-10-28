import { emptyState } from "./model.mjs";
export function demoState() {
  const s = emptyState();
  s.accounts = [
    {
      id: "demo-1",
      name: "50K Evaluation",
      number: "DEMO-504821",
      currency: "USD",
      status: "active",
      initialBalance: 50000,
      balance: 53820,
      source: "demo",
      rules: {
        profitTarget: 2500,
        consistencyPercent: 40,
        profitableDays: 5,
        minimumDayProfit: 100,
        maxDrawdown: 1500,
      },
      drawdownRemaining: 1390,
    },
    {
      id: "demo-2",
      name: "100K Funded",
      number: "DEMO-100936",
      currency: "USD",
      status: "active",
      initialBalance: 100000,
      balance: 102190,
      source: "demo",
      rules: { profitableDays: 5, minimumDayProfit: 100, maxDrawdown: 3000 },
      drawdownRemaining: 2450,
    },
    {
      id: "demo-3",
      name: "25K Evaluation",
      number: "DEMO-250127",
      currency: "USD",
      status: "failed",
      initialBalance: 25000,
      balance: 24250,
      source: "demo",
      rules: { profitTarget: 1250, consistencyPercent: 40, maxDrawdown: 750 },
      drawdownRemaining: 0,
    },
  ];
  s.playbooks = [
    {
      id: "pb1",
      name: "Opening range breakout",
      description: "A structured breakout after the first 15 minutes.",
      rules: [
        "Mark the opening range",
        "Wait for a close outside the range",
        "Define stop and target before entry",
      ],
      color: "#b8f277",
    },
    {
      id: "pb2",
      name: "Liquidity sweep",
      description: "Wait for a sweep and reclaim at a planned level.",
      rules: [
        "Identify the liquidity level",
        "Wait for the reclaim",
        "Confirm risk fits the plan",
      ],
      color: "#b9a7f8",
    },
    {
      id: "pb3",
      name: "Trend pullback",
      description: "A patient entry in the direction of the session trend.",
      rules: [
        "Identify trend structure",
        "Wait for the pullback",
        "Avoid chasing an extended candle",
      ],
      color: "#70ced4",
    },
  ];
  let seed = 284;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const now = new Date();
  const base = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  for (let day = 0; day < 26; day++) {
    const d = new Date(base);
    d.setUTCDate(day + 1);
    if ([0, 6].includes(d.getUTCDay())) continue;
    for (let j = 0; j < 3 + (day % 3); j++) {
      const win = rand() > 0.36,
        pnl = win
          ? 80 + Math.round(rand() * 440)
          : -70 - Math.round(rand() * 240);
      const open = new Date(d);
      open.setUTCHours(13 + j, 30);
      const close = new Date(
        open.getTime() + (15 + Math.round(rand() * 90)) * 60000,
      );
      const entry = 19400 + Math.round(rand() * 800),
        side = rand() > 0.5 ? "long" : "short",
        quantity = 1 + Math.floor(rand() * 3);
      s.trades.push({
        id: `demo-${day}-${j}`,
        accountId: day % 4 === 0 ? "demo-2" : "demo-1",
        externalId: `demo-${day}-${j}`,
        symbol: j % 3 === 0 ? "ES" : "NQ",
        side,
        status: "closed",
        quantity,
        entryPrice: entry,
        exitPrice: entry + ((side === "long" ? 1 : -1) * pnl) / (20 * quantity),
        openedAt: open.toISOString(),
        closedAt: close.toISOString(),
        grossPnl: pnl,
        fees: quantity * 4.2,
        initialRisk: 150,
        tags: win ? ["Focused"] : ["Early entry"],
        strategy: s.playbooks[j % 3].name,
        rating: win ? 4 : 2,
        reviewed: day < 18,
        notes: "Sample trade for exploring the journal.",
        source: "demo",
      });
    }
  }
  s.trades.push({
    id: "demo-open",
    accountId: "demo-2",
    symbol: "MNQ",
    side: "long",
    status: "open",
    quantity: 2,
    entryPrice: 20120,
    openedAt: new Date().toISOString(),
    grossPnl: 0,
    fees: 2.4,
    initialRisk: 100,
    unrealizedPnl: 128.4,
    markAt: new Date().toISOString(),
    tags: [],
    strategy: "Trend pullback",
    source: "demo",
  });
  s.notes = [
    {
      id: "note-demo",
      date: new Date().toISOString().slice(0, 10),
      accountId: "all",
      title: "Patience is part of the edge",
      body: "Today’s focus\nWait for price to reach the levels in my plan.\n\nWhat worked\nDefined my risk before entry and let the setup develop.\n\nNext session\nTake a short break after two consecutive losses.",
      type: "Daily review",
    },
  ];
  s.sync = {
    status: "demo",
    lastSync: null,
    coverage: "Sample data — not connected to a real account",
  };
  return s;
}
