// Field mappings verified against TradersYard's public Vue query/table modules, 2026-10-27.
const finite = (v) =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))
    ? Number(v)
    : null;
export function normalizeAccount(
  raw,
  providerStats = null,
  definition = null,
  levels = null,
) {
  if (!raw?.tc_id || typeof raw.tc_id !== "string")
    throw Error("Provider account is missing tc_id.");
  const level = raw.current_level || {},
    state = raw.state || {},
    r = level.rules || {},
    meta = raw.meta || {};
  const rules = {};
  const add = (k, v) => {
    const n = finite(v);
    if (n !== null) rules[k] = n;
  };
  add("profitTarget", r.profit_target?.value);
  add("consistencyPercent", r.consistency?.consistency_target);
  add("profitableDays", r.minimum_profitable_days?.days);
  add("minimumDayProfit", r.minimum_profitable_days?.target);
  add("maxDrawdown", r.eod_trailing_max_dd?.offset ?? r.level_risk?.value);
  add("dailyDrawdown", r.daily_risk?.value);
  return {
    id: `ty:${raw.tc_id}`,
    number: raw.tc_id,
    name:
      [
        meta.variant?.toUpperCase(),
        meta.definition_key,
        level.level_name || level.name || level.type,
      ]
        .filter(Boolean)
        .join(" · ") || raw.tc_id,
    currency: raw.currency || "USD",
    currencySource: raw.currency
      ? "provider"
      : "USD display convention in provider UI",
    status: String(raw.status || "unknown").replaceAll("_", "-"),
    source: "tradersyard",
    initialBalance: finite(level.cash_value),
    balance: finite(state.cash_value),
    providerClosedPnl: finite(state.closed_profit_loss),
    providerOpenPnl: finite(state.open_profit_loss),
    providerTotalPnl: finite(state.total_profit_loss),
    providerDailyPnl: finite(state.daily_profit_loss),
    dailyDrawdownRemaining: finite(state.to_daily_loss_limit),
    drawdownRemaining: finite(
      state.to_eod_max_dd_limit ??
        state.to_level_loss_limit ??
        state.to_max_loss_limit,
    ),
    rules,
    providerRaw: raw,
    providerRuleStatus: {
      state,
      stats: providerStats,
      currentLevel: level,
      definition,
      levels,
      meta,
    },
    syncedAt: new Date().toISOString(),
  };
}
function timestamp(v, field) {
  if (
    !v ||
    typeof v !== "string" ||
    !/(Z|[+-]\d\d:\d\d)$/.test(v) ||
    !Number.isFinite(new Date(v).getTime())
  )
    throw Error(`Unknown ${field} timezone or invalid timestamp`);
  return new Date(v).toISOString();
}
export function normalizeProviderTrade(raw, tcId, status) {
  if (raw.id == null || !raw.instrument)
    throw Error("Trade is missing provider ID or instrument.");
  const isOpen = status === "open",
    side = isOpen ? raw.type : raw.originType;
  if (!["long", "short"].includes(side))
    throw Error("Unknown trade direction.");
  const lot = finite(raw.lotSize) ?? 1;
  if (lot <= 0) throw Error("Invalid lot size.");
  const amount = finite(isOpen ? raw.quantity : raw.volume),
    price = finite(raw.price ?? raw.entryPrice);
  if (amount === null || amount <= 0 || price === null)
    throw Error("Trade quantity or entry price is missing.");
  const pnl = finite(isOpen ? raw.openProfitLoss : raw.closedProfitLoss);
  if (!isOpen && pnl === null) throw Error("Closed P&L is missing.");
  const openedAt = timestamp(raw.createdDateTime, "entry");
  const closedAt = isOpen ? null : timestamp(raw.lastChangeDateTime, "exit");
  // The live analytics API reuses IDs across closed rows. Keep every execution.
  const identity = [
    status,
    String(raw.id),
    raw.instrument,
    side,
    openedAt,
    closedAt || "",
  ]
    .map(encodeURIComponent)
    .join(":");
  return {
    id: `ty:${tcId}:${identity}`,
    identityVersion: 2,
    providerRaw: raw,
    externalId: String(raw.id),
    accountId: `ty:${tcId}`,
    symbol: raw.instrument,
    side,
    status,
    quantity: amount / lot,
    providerQuantity: amount,
    lotSize: lot,
    entryPrice: price,
    firstEntryPrice: finite(raw.entryPrice),
    exitPrice: isOpen ? null : finite(raw.avgExitPrice ?? raw.exitPrice),
    openedAt,
    closedAt,
    grossPnl: isOpen ? 0 : pnl,
    providerNetPnl: isOpen ? null : pnl,
    pnlBasis: "provider-reported; fee breakdown unavailable",
    fees: 0,
    feesKnown: false,
    unrealizedPnl: isOpen ? pnl : null,
    markAt: isOpen ? new Date().toISOString() : null,
    initialRisk: 0,
    tags: [],
    strategy: "",
    notes: "",
    reviewed: false,
    source: "tradersyard",
  };
}
export async function collectTradersYard(getJson, {
  refreshHistory = true, existing = [], onProgress = () => {},
  onSnapshot = async () => {}, retryIssues = null,
} = {}) {
  const previous = new Map(existing.map(account => [account.id, account]));
  const accounts = new Map(), trades = [], issues = [], plans = [];
  const completedOpenAccountIds = [], completedClosedAccountIds = [];
  const fatal = error => ['TY_AUTH_REQUIRED','TY_DISCONNECTED','TY_RATE_LIMIT'].includes(error?.code);
  let page = 1, last = 1;
  // Publish every list page before any slower history/detail requests.
  do {
    const result = await getJson(`/api/v4.0/challenges?page=${page}&type%5B%5D=challenge&type%5B%5D=funded`);
    if (!Array.isArray(result.data)) throw Error('Account API schema changed: expected data array.');
    last = Number(result.meta?.last_page || 1);
    if (!Number.isInteger(last) || last < page || last > 200) throw Error('Unexpected account pagination.');
    const discovered = [];
    for (const raw of result.data) {
      const tcId = raw?.tc_id;
      if (!/^[A-Za-z0-9_-]+$/.test(tcId || '')) { issues.push('Invalid account identifier'); continue; }
      const id = `ty:${tcId}`, old = previous.get(id);
      if (accounts.has(id)) continue;
      try {
        const account = {...old, ...normalizeAccount({...old?.providerRaw, ...raw}, old?.providerRuleStatus?.stats, old?.providerRuleStatus?.definition, old?.providerRuleStatus?.levels)};
        accounts.set(id, account); discovered.push(account);
        const active = ['active','in_risk_review','in-risk-review','profit_target_reached'].includes(raw.status);
        const changed = old?.status !== account.status || old?.providerClosedPnl !== account.providerClosedPnl;
        const retryNames = old && retryIssues ? new Set(retryIssues.filter(issue => issue.startsWith(`${tcId} `)).map(issue => issue.slice(tcId.length + 1).split(/[ :]/)[0])) : null;
        const wanted = name => !retryNames || retryNames.has(name);
        const history = refreshHistory || !old?.historySyncedAt || active || changed || retryNames?.has('closed');
        const endpoints = [];
        if (history && wanted('closed')) endpoints.push(['closed', `/api/v3.0/trader-challenge-analytics/${tcId}/closed`]);
        if ((refreshHistory || !old?.openSyncedAt || active || changed || retryNames?.has('open')) && wanted('open')) endpoints.push(['open', `/api/v3.0/trader-challenge-analytics/${tcId}/open`]);
        const details = [];
        for (const [name,suffix] of [['detail',''],['stats','/stats'],['definition','/definition'],['levels','/levels']]) {
          const cached = name === 'detail' ? old?.detailsSyncedAt : old?.providerRuleStatus?.[name];
          const dynamic = name === 'detail' || name === 'stats';
          if (wanted(name) && (!cached || (dynamic && (active || changed || refreshHistory)) || retryNames?.has(name))) details.push([name, `/api/v4.0/challenges/${tcId}${suffix}`]);
        }
        plans.push({id,tcId,endpoints,details});
      } catch (error) { issues.push(`${tcId}: ${error.message}`); }
    }
    await onSnapshot({accounts:discovered,trades:[]}, {phase:'accounts',completed:page,total:last,accounts:accounts.size});
    page++;
  } while (page <= last);

  async function fetchData(plan, name, route) {
    try { return (await getJson(route)).data; }
    catch (error) {
      if (fatal(error)) throw error;
      issues.push(`${plan.tcId} ${name}: ${error.message}`);
      return undefined;
    }
  }
  // All accounts' trade history comes before optional rule/detail enrichment.
  const tradeTasks = plans.reduce((sum, plan) => sum + plan.endpoints.length, 0);
  let done = 0;
  for (const plan of plans) {
    for (const [type,route] of plan.endpoints) {
      const data = await fetchData(plan,type,route), batch = [];
      const open = [], closed = [];
      if (data !== undefined) {
        if (!Array.isArray(data)) issues.push(`${plan.tcId} ${type}: expected array`);
        else {
          let rejected = 0;
          const identities = new Map();
          for (const row of data) {
            try {
              const trade = normalizeProviderTrade(row,plan.tcId,type);
              const count = identities.get(trade.id) || 0;
              identities.set(trade.id,count + 1);
              if (count) trade.id += `:duplicate-${count}`;
              batch.push(trade);
            } catch (error) { rejected++; issues.push(`${plan.tcId} ${type} row ${row?.id ?? '?'}: ${error.message}`); }
          }
          if (!rejected) {
            const account = accounts.get(plan.id);
            accounts.set(plan.id,{...account,[type === 'closed' ? 'historySyncedAt' : 'openSyncedAt']:new Date().toISOString()});
            (type === 'closed' ? closed : open).push(plan.id);
          }
        }
      }
      trades.push(...batch);
      completedOpenAccountIds.push(...open); completedClosedAccountIds.push(...closed);
      await onSnapshot({accounts:[accounts.get(plan.id)],trades:batch,completedOpenAccountIds:open,completedClosedAccountIds:closed}, {phase:'trades',completed:++done,total:tradeTasks,accounts:accounts.size,trades:trades.length});
      onProgress({completed:done,total:tradeTasks,phase:'trades'});
    }
  }
  done = 0;
  const detailTasks = plans.filter(plan => plan.details.length).length;
  for (const plan of plans) {
    if (!plan.details.length) continue;
    const data = {};
    for (const [name,route] of plan.details) data[name] = await fetchData(plan,name,route);
    const old = accounts.get(plan.id);
    const account = {...old, ...normalizeAccount({...old.providerRaw,...data.detail}, data.stats ?? old.providerRuleStatus?.stats, data.definition ?? old.providerRuleStatus?.definition, data.levels ?? old.providerRuleStatus?.levels)};
    if (data.detail !== undefined) account.detailsSyncedAt = new Date().toISOString();
    accounts.set(plan.id,account);
    await onSnapshot({accounts:[account],trades:[]}, {phase:'rules',completed:++done,total:detailTasks,accounts:accounts.size,trades:trades.length});
    onProgress({completed:done,total:detailTasks,phase:'rules'});
  }
  return {accounts:[...accounts.values()],trades,completedOpenAccountIds,completedClosedAccountIds,issues,coverage:{scope:retryIssues?'retry-history':refreshHistory?'full-history':'account-refresh',accounts:accounts.size,accountsImported:accounts.size,tradeRows:trades.length,issues,history:'API-returned history; retention and broker fill coverage not guaranteed',syncedAt:new Date().toISOString()}};
}
