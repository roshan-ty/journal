export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function dayKey(value, timezone = "Asia/Karachi") {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export const net = (t) =>
  Number.isFinite(t.providerNetPnl)
    ? round(t.providerNetPnl)
    : round(Number(t.grossPnl || 0) - Number(t.fees || 0));
export function filterTrades(
  trades,
  {
    account = "all",
    from = "",
    to = "",
    symbol = "",
    strategy = "",
    tag = "",
    side = "",
    status = "",
    timezone = "Asia/Karachi",
    currency = "USD",
    accounts = [],
  } = {},
) {
  const allowed = new Set(
    accounts.filter((a) => a.currency === currency).map((a) => a.id),
  );
  return trades.filter((t) => {
    const d = dayKey(t.closedAt || t.openedAt, timezone);
    return (
      (account === "all" || t.accountId === account) &&
      (!accounts.length || allowed.has(t.accountId)) &&
      (!from || d >= from) &&
      (!to || d <= to) &&
      (!symbol || t.symbol.toLowerCase().includes(symbol.toLowerCase())) &&
      (!strategy || t.strategy === strategy) &&
      (!tag || (t.tags || []).includes(tag)) &&
      (!side || t.side === side) &&
      (!status || t.status === status)
    );
  });
}
export function groupBy(trades, key, timezone = "Asia/Karachi") {
  const groups = new Map();
  for (const t of trades.filter((t) => t.status === "closed")) {
    const k =
      typeof key === "function"
        ? key(t)
        : key === "day"
          ? dayKey(t.closedAt, timezone)
          : t[key] || "Unassigned";
    const group = groups.get(k) || [];
    group.push(t);
    groups.set(k, group);
  }
  return [...groups].map(([name, rows]) => ({
    name,
    ...stats(rows, timezone, false),
  }));
}
export function stats(trades, timezone = "Asia/Karachi", withSeries = true) {
  const closed = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));
  const wins = closed.filter((t) => net(t) > 0),
    losses = closed.filter((t) => net(t) < 0),
    breakeven = closed.length - wins.length - losses.length;
  const total = round(closed.reduce((s, t) => s + net(t), 0)),
    profit = wins.reduce((s, t) => s + net(t), 0),
    loss = -losses.reduce((s, t) => s + net(t), 0);
  let cumulative = 0,
    peak = 0,
    maxDrawdown = 0,
    winStreak = 0,
    lossStreak = 0,
    currentWin = 0,
    currentLoss = 0;
  const curve = [];
  for (const t of closed) {
    const p = net(t);
    cumulative = round(cumulative + p);
    peak = Math.max(peak, cumulative);
    const dd = round(peak - cumulative);
    maxDrawdown = Math.max(maxDrawdown, dd);
    currentWin = p > 0 ? currentWin + 1 : 0;
    currentLoss = p < 0 ? currentLoss + 1 : 0;
    winStreak = Math.max(winStreak, currentWin);
    lossStreak = Math.max(lossStreak, currentLoss);
    curve.push({
      name: dayKey(t.closedAt, timezone),
      time: t.closedAt,
      pnl: cumulative,
      drawdown: -dd,
      tradePnl: p,
    });
  }
  const rTrades = closed.filter((t) => Number(t.initialRisk) > 0),
    rs = rTrades.map((t) => net(t) / t.initialRisk);
  const marked = trades.filter(
    (t) => t.status === "open" && Number.isFinite(t.unrealizedPnl),
  );
  return {
    total,
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor: loss ? profit / loss : profit ? Infinity : null,
    averageWin: wins.length ? profit / wins.length : 0,
    averageLoss: losses.length ? loss / losses.length : 0,
    expectancy: closed.length ? total / closed.length : 0,
    fees: round(closed.reduce((s, t) => s + Number(t.fees || 0), 0)),
    feesUnknownCount: closed.filter((t) => t.feesKnown === false).length,
    averageR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rCoverage: rs.length,
    maxDrawdown,
    winStreak,
    lossStreak,
    best: closed.length ? Math.max(...closed.map(net)) : 0,
    worst: closed.length ? Math.min(...closed.map(net)) : 0,
    openCount: trades.filter((t) => t.status === "open").length,
    unrealized: marked.length
      ? round(marked.reduce((s, t) => s + t.unrealizedPnl, 0))
      : null,
    markedCount: marked.length,
    reviewed: closed.filter((t) => t.reviewed).length,
    curve: withSeries ? curve : [],
    daily: withSeries
      ? groupBy(closed, "day", timezone).sort((a, b) =>
          a.name.localeCompare(b.name),
        )
      : [],
  };
}
export function ruleProgress(account, trades, timezone = "Asia/Karachi") {
  const s = stats(
      trades.filter((t) => t.accountId === account.id),
      timezone,
    ),
    days = s.daily;
  const bestDay = Math.max(0, ...days.map((d) => d.total));
  const consistency = s.total > 0 ? (bestDay / s.total) * 100 : null;
  const rules = account.rules || {};
  const provider = account.providerRuleStatus?.stats;
  const profit = Number.isFinite(account.providerClosedPnl)
    ? account.providerClosedPnl
    : s.total;
  const consistencyValue = Number.isFinite(provider?.consistency)
    ? provider.consistency
    : consistency;
  const profitableCount = Number.isFinite(provider?.profitable_days_count)
    ? provider.profitable_days_count
    : account.source === "tradersyard"
      ? null
      : days.filter(
          (d) => d.total >= (rules.minimumDayProfit ?? 0) && d.total > 0,
        ).length;
  const result = [];
  if (Number.isFinite(rules.profitTarget))
    result.push({
      name: "Profit target",
      value: profit,
      target: rules.profitTarget,
      unit: "money",
      passed: profit >= rules.profitTarget,
      source: Number.isFinite(account.providerClosedPnl)
        ? "provider"
        : "journal",
      kind: "minimum",
    });
  if (Number.isFinite(rules.consistencyPercent))
    result.push({
      name: "Best-day consistency",
      value: consistencyValue,
      target: rules.consistencyPercent,
      unit: "percent",
      passed:
        typeof provider?.consistency_target_reached === "boolean"
          ? provider.consistency_target_reached
          : consistencyValue !== null &&
            consistencyValue < rules.consistencyPercent,
      source: Number.isFinite(provider?.consistency) ? "provider" : "journal",
      kind: "maximum",
    });
  if (Number.isFinite(rules.profitableDays))
    result.push({
      name: "Profitable days",
      value: profitableCount,
      target: rules.profitableDays,
      unit: "days",
      passed:
        profitableCount !== null && profitableCount >= rules.profitableDays,
      source: Number.isFinite(provider?.profitable_days_count)
        ? "provider"
        : "journal",
      kind: "minimum",
    });
  if (Number.isFinite(account.drawdownRemaining))
    result.push({
      name: "Drawdown remaining",
      value: account.drawdownRemaining,
      target: rules.maxDrawdown ?? null,
      unit: "money",
      passed: account.drawdownRemaining > 0,
      kind: "remaining",
      source: "provider",
    });
  if (Number.isFinite(account.dailyDrawdownRemaining))
    result.push({
      name: "Daily drawdown remaining",
      value: account.dailyDrawdownRemaining,
      target: rules.dailyDrawdown ?? null,
      unit: "money",
      passed: account.dailyDrawdownRemaining > 0,
      kind: "remaining",
      source: "provider",
    });
  return {
    rules: result,
    consistency,
    bestDay,
    computedFrom:
      "Imported closed trades; provider rule status takes precedence",
    provider: account.providerRuleStatus || null,
  };
}
