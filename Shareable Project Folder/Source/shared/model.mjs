import product from '../product.json' with {type:'json'};
export const uid = () => globalThis.crypto.randomUUID();
export function emptyState() {
  return {
    schemaVersion: 1,
    profile: null,
    accounts: [],
    trades: [],
    notes: [],
    playbooks: [],
    habits: [
      { id: "plan", name: "Write a pre-market plan" },
      { id: "risk", name: "Define risk before entry" },
      { id: "review", name: "Review every closed trade" },
    ],
    habitLog: {},
    candles: [],
    backtests: [],
    settings: {
      brand: product.name,
      timezone: "Asia/Karachi",
      currency: "USD",
      theme: "dark",
      coachKnowledge: "",
    },
    sync: { connection: "disconnected", status: "disconnected", lastSync: null, coverage: null },
  };
}
export function validateTrade(t, accounts) {
  if (!accounts.some((a) => a.id === t.accountId))
    throw Error("Select a valid account.");
  if (!t.id || !t.symbol?.trim())
    throw Error("Trade ID and symbol are required.");
  if (
    !["long", "short"].includes(t.side) ||
    !["open", "closed"].includes(t.status)
  )
    throw Error("Invalid direction or trade status.");
  if (!Number.isFinite(Number(t.quantity)) || Number(t.quantity) <= 0)
    throw Error("Quantity must be greater than zero.");
  for (const k of ["entryPrice", "fees"])
    if (!Number.isFinite(Number(t[k])) || Number(t[k]) < 0)
      throw Error(`${k} must be a nonnegative number.`);
  if (
    typeof t.openedAt !== "string" ||
    !/(Z|[+-]\d\d:\d\d)$/.test(t.openedAt) ||
    !Number.isFinite(new Date(t.openedAt).getTime())
  )
    throw Error("A valid entry date is required.");
  if (
    t.status === "closed" &&
    (typeof t.closedAt !== "string" ||
      !/(Z|[+-]\d\d:\d\d)$/.test(t.closedAt) ||
      !Number.isFinite(new Date(t.closedAt).getTime()) ||
      new Date(t.closedAt) < new Date(t.openedAt) ||
      !Number.isFinite(Number(t.grossPnl)))
  )
    throw Error(
      "Closed trades need a valid exit time after entry and a gross P&L.",
    );
  if (
    t.initialRisk != null &&
    (!Number.isFinite(Number(t.initialRisk)) || t.initialRisk < 0)
  )
    throw Error("Initial risk must be nonnegative.");
  for (const key of ['grossPnl','providerNetPnl','unrealizedPnl','exitPrice'])
    if (t[key] != null && !Number.isFinite(Number(t[key]))) throw Error(`Invalid ${key}.`);
  for (const key of ['notes','strategy'])
    if (t[key] != null && typeof t[key] !== 'string') throw Error(`Invalid trade ${key}.`);
  if (t.attachments != null && (!Array.isArray(t.attachments) || t.attachments.some(a =>
    !a || typeof a.name !== 'string' || typeof a.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(a.data))))
    throw Error('Invalid trade screenshots.');
  return {
    ...t,
    symbol: t.symbol.trim().toUpperCase(),
    quantity: Number(t.quantity),
    entryPrice: Number(t.entryPrice),
    grossPnl: Number(t.grossPnl || 0),
    fees: Number(t.fees || 0),
    initialRisk: Number(t.initialRisk || 0),
    tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
  };
}
export function validateState(s) {
  if (
    s?.schemaVersion !== 1 ||
    !Array.isArray(s.accounts) ||
    !Array.isArray(s.trades)
  )
    throw Error("Unsupported journal backup.");
  if (s.profile != null && (typeof s.profile.id !== 'string' || !s.profile.id ||
    typeof s.profile.name !== 'string' || !s.profile.name.trim() || s.profile.name.length > 80))
    throw Error('Enter a profile name of 1–80 characters.');
  const seen = new Set();
  for (const a of s.accounts) {
    if (!a || typeof a.id !== 'string' || !a.id || typeof a.number !== 'string' || !a.number ||
      !/^[A-Z]{3}$/.test(a.currency || '') || seen.has(a.id))
      throw Error("Invalid or duplicate account.");
    seen.add(a.id);
  }
  const ids = new Set();
  const normalized = [];
  for (const t of s.trades) {
    normalized.push(validateTrade(t, s.accounts));
    if (ids.has(t.id)) throw Error("Duplicate trade ID.");
    ids.add(t.id);
  }
  const collections = {};
  for (const key of ["notes", "playbooks", "habits", "candles", "backtests"]) {
    collections[key] = s[key] ?? emptyState()[key];
    if (!Array.isArray(collections[key]) || collections[key].some(item => !item || typeof item !== 'object' || Array.isArray(item)))
      throw Error(`Invalid ${key} in backup.`);
  }
  for (const note of collections.notes)
    if (typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') throw Error('Invalid note in backup.');
  for (const book of collections.playbooks)
    if (typeof book.id !== 'string' || typeof book.name !== 'string' || !Array.isArray(book.rules) || book.rules.some(rule => typeof rule !== 'string')) throw Error('Invalid strategy in backup.');
  for (const habit of collections.habits)
    if (typeof habit.id !== 'string' || typeof habit.name !== 'string') throw Error('Invalid habit in backup.');
  const habitLog = s.habitLog ?? {};
  if (typeof habitLog !== 'object' || Array.isArray(habitLog)) throw Error('Invalid habit log in backup.');
  const settings = { ...emptyState().settings, ...s.settings };
  if (
    typeof settings.brand !== "string" ||
    settings.brand.length > 80 ||
    !["dark", "light"].includes(settings.theme) ||
    !/^[A-Z]{3}$/.test(settings.currency)
  )
    throw Error("Invalid workspace preferences.");
  new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone });
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: settings.currency,
  });
  const sync = s.sync ?? emptyState().sync;
  if (!sync || typeof sync !== 'object' || Array.isArray(sync) ||
    !['disconnected', 'connected', 'partial', 'syncing', 'error'].includes(sync.status) ||
    (sync.connection != null && !['connected', 'disconnected'].includes(sync.connection)))
    throw Error('Invalid connection state in backup.');
  return {
    ...emptyState(),
    ...s,
    ...collections,
    habitLog,
    trades: normalized,
    settings,
    sync: {...sync, connection: sync.connection ?? (
      s.accounts.some(a => a.source === 'tradersyard') && ['connected','partial','syncing'].includes(sync.status)
        ? 'connected' : 'disconnected'
    )},
  };
}
export function mergeSnapshot(state, snapshot) {
  if (
    !snapshot ||
    !Array.isArray(snapshot.accounts) ||
    !Array.isArray(snapshot.trades)
  )
    throw Error("Invalid provider snapshot.");
  const accounts = new Map(state.accounts.map((a) => [a.id, a]));
  for (const a of snapshot.accounts)
    accounts.set(a.id, { ...accounts.get(a.id), ...a });
  const currentIds = new Set(snapshot.trades.map((t) => t.id));
  const refreshed = new Set(snapshot.completedOpenAccountIds || []);
  const closedRefreshed = new Set(snapshot.completedClosedAccountIds || []);
  const trades = new Map(
    state.trades
      .filter(
        (t) =>
          !(
            t.source === "tradersyard" &&
            t.identityVersion !== 2 &&
            closedRefreshed.has(t.accountId)
          ) &&
          !(
            t.source === "tradersyard" &&
            t.status === "open" &&
            refreshed.has(t.accountId) &&
            !currentIds.has(t.id)
          ),
      )
      .map((t) => [t.id, t]),
  );
  let added = 0,
    updated = 0;
  for (const incoming of snapshot.trades) {
    const t = validateTrade(incoming, [...accounts.values()]);
    const old =
      trades.get(t.id) ||
      state.trades.find(
        (previous) =>
          previous.source === "tradersyard" &&
          previous.accountId === t.accountId &&
          previous.externalId === t.externalId &&
          previous.openedAt === t.openedAt &&
          ((previous.identityVersion !== 2 &&
            previous.closedAt === t.closedAt) ||
            (previous.status === "open" &&
              t.status === "closed" &&
              previous.side === t.side)),
      );
    if (old) {
      updated++;
      trades.set(t.id, {
        ...t,
        notes: old.notes || "",
        tags: old.tags || [],
        strategy: old.strategy || "",
        reviewed: old.reviewed || false,
        rating: old.rating || 0,
        initialRisk: old.initialRisk || t.initialRisk || 0,
        attachments: old.attachments || [],
      });
    } else {
      added++;
      trades.set(t.id, t);
    }
  }
  return {
    state: {
      ...state,
      accounts: [...accounts.values()],
      trades: [...trades.values()],
      sync: {
        ...state.sync,
        status: "connected",
        lastSync: new Date().toISOString(),
        coverage: snapshot.coverage || "partial",
        message: `${added} new trades, ${updated} refreshed`,
      },
    },
    added,
    updated,
  };
}
