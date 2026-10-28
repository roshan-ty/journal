// A delayed save/read must never move the visible journal behind a newer sync.
export function newerRecord(current, incoming) {
  if (!incoming || !Number.isSafeInteger(incoming.revision) || incoming.revision < 0)
    throw Error('Invalid journal revision. Reload your workspace.');
  return incoming.revision >= current.revision ? incoming : current;
}

// IPC returns fresh objects even when only sync progress changed. Reuse equal
// collections so analytical memoization does not rerun for every status update.
export function reuseJournalData(current,incoming) {
  const next = newerRecord(current,incoming);
  if (next === current || !current.state || !next.state) return next;
  const state = {...next.state};
  for (const key of ['accounts','trades','notes','playbooks','habits','habitLog','candles','backtests','settings','profile']) {
    if (current.state[key] === state[key] || JSON.stringify(current.state[key]) === JSON.stringify(state[key])) state[key] = current.state[key];
  }
  return {...next,state};
}
