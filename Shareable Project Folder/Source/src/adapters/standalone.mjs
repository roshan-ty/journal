import product from '../../product.json' with {type:'json'};
import { emptyState, validateState } from '../../shared/model.mjs';

// Persistence and provider access belong to adapters, never page components.
export function createBrowserAdapter(storage = localStorage, key = product.browserKey) {
  const listeners = new Set();
  return {
    capabilities: { connect: false, sync: false },
    async load() {
      const raw = JSON.parse(storage.getItem(key) || 'null');
      return raw?.state ? { state: validateState(raw.state), revision: raw.revision } :
        { state: raw ? validateState(raw) : emptyState(), revision: 0 };
    },
    async save(state, revision) {
      const current = await this.load();
      if (current.revision !== revision) throw Error('Your journal changed in another window. Please retry.');
      const result = {state: validateState(state), revision: revision + 1};
      storage.setItem(key, JSON.stringify(result));
      listeners.forEach(fn => fn());
      return result;
    },
    subscribe(fn) {
      listeners.add(fn);
      const handler = event => { if (event.key === key) fn(); };
      globalThis.addEventListener?.('storage', handler);
      return () => { listeners.delete(fn); globalThis.removeEventListener?.('storage', handler); };
    },
    async connect() { throw Error('Use the Windows app to sign in to TradersYard.'); },
  };
}

export function createStandaloneAdapter() {
  const desktop = window.journal;
  if (!desktop) return createBrowserAdapter();
  return {
    capabilities: {connect: true, sync: true},
    load: desktop.load, save: desktop.save, subscribe: desktop.onChange,
    connect: desktop.connect, sync: desktop.sync, retry: desktop.retry,
    disconnect: desktop.disconnect, exportBackup: desktop.exportBackup,
  };
}
