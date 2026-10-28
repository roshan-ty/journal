// Keep authentication independent of sync progress, data coverage and saved history.
// The fallback supports journals created before 0.2.1 and existing host adapters.
export function isTradersYardConnected(sync = {}) {
  if (sync.connection === 'connected') return true;
  if (sync.connection === 'disconnected') return false;
  return ['connected', 'partial', 'syncing'].includes(sync.status);
}
