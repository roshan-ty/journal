const product = require('../product.json');
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { openStore } = require("./store.cjs");
const { TradersYardProvider } = require("./provider.cjs");
const { showMaximized } = require("./window.cjs");
const { createSynchronizer } = require('./sync.cjs');
const diagnostic = (message) => { if (process.env.TY_JOURNAL_DIAGNOSTICS === '1') console.error(`[Journal] ${message}`); };
diagnostic('Main process started');
// Keep the official browser session in the same folder for development and packaged builds.
app.setPath('userData', path.join(app.getPath('appData'), product.sessionDirectory));
const dataDir =
  process.env[product.dataEnvironment] ||
  path.join(app.getPath("appData"), product.dataDirectory);
let store,
  mainWindow,
  provider,
  timer,
  commandTimer,
  connected = false,
  connectionEpoch = 0,
  model,
  collect;
const notify = () => {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("journal:changed");
};
let synchronize;
let backgroundPending;
function refreshConnected() {
  if (backgroundPending) return backgroundPending;
  backgroundPending = Promise.resolve().then(async () => {
    await synchronize(false);
    if (connected && store.read().state.sync.lastFullCoverage?.issues?.length) await synchronize(false,true);
  }).catch(()=>{}).finally(()=>{backgroundPending=null;});
  return backgroundPending;
}
function trusted(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  )
    throw Error("Untrusted IPC caller.");
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    trusted(event);
    return fn(...args);
  });
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    title: product.name,
    width: 1500,
    height: 1000,
    minWidth: 780,
    minHeight: 620,
    backgroundColor: "#0f0f0f",
    icon: path.join(__dirname, "../build/icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    try { const target=new URL(url);
      if(target.protocol==='https:' && (['tradersyard.com','help.tradersyard.com'].includes(target.hostname) || (product.partners && ['https://shop.tradersyard.com/ref/1486/','https://www.feefo.com/en-GB/reviews/tradersyard'].includes(target.href))))
        shell.openExternal(target.href).catch(()=>{});
    } catch {}
    return { action: 'deny' };
  });
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.once("ready-to-show", () => showMaximized(mainWindow));
  mainWindow.on("closed", () => {
    mainWindow = null;
    // The login window is part of this app, so it must not keep the process alive.
    provider.closeAuthWindows();
    app.quit();
  });
  await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.setAppUserModelId(product.appId);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    showMaximized(mainWindow);
  });
  app
    .whenReady()
    .then(async () => {
      diagnostic('Electron ready');
      Menu.setApplicationMenu(null);
      model = await import(
        pathToFileURL(path.join(__dirname, "../shared/model.mjs"))
      );
      ({ collectTradersYard: collect } = await import(
        pathToFileURL(path.join(__dirname, "../shared/tradersyard.mjs"))
      ));
      store = openStore(dataDir);
      diagnostic('Journal store opened');
      if (!store.read()) store.save(model.emptyState());
      if (!store.read().state.sync?.connection) {
        const current = store.read();
        store.save(model.validateState(current.state), current.revision);
      }
      const { isTradersYardConnected } = await import(pathToFileURL(path.join(__dirname, '../shared/connection.mjs')));
      connected = isTradersYardConnected(store.read().state.sync);
      provider = new TradersYardProvider({
        onReady: () => synchronize(true),
        onAuthIssue: (message) => {
          const current = store.read();
          store.save({...current.state, sync: {...current.state.sync, status:'error', message}}, current.revision);
          notify();
        },
        onConnectionChange: (authenticated, error) => {
          connected = authenticated;
          const current = store.read();
          store.save({...current.state, sync: {
            ...current.state.sync,
            connection: authenticated ? 'connected' : 'disconnected',
            ...(error ? {status:'error',message:error.message} : {}),
          }}, current.revision);
          notify();
          if (authenticated && provider.window && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      });
      diagnostic('Provider initialized');
      synchronize = createSynchronizer({store,provider,model,collect,notify,getEpoch:()=>connectionEpoch});
      if (store.read().state.sync.status === 'syncing') { const current=store.read();store.save({...current.state,sync:{...current.state.sync,status:'partial',message:'Previous sync was interrupted. Sync again to finish.'}},current.revision); }
      store.db.prepare("UPDATE commands SET status='error',result=? WHERE status='running'").run(JSON.stringify({error:'The app closed before this request completed. Request sync again.'}));
      handle("journal:load", () => store.read());
      handle("journal:save", ({ state, revision }) => {
        const validated = model.validateState(state);
        // Connection state is owned by the main process, never by a renderer edit.
        return store.save({...validated, sync: store.read().state.sync}, revision);
      });
      handle("provider:connect", () => provider.connect());
      handle("provider:sync", () => synchronize(true));
      handle("provider:retry", () => synchronize(true, true));
      handle("provider:disconnect", async () => {
        connectionEpoch++;
        connected = false;
        await provider.disconnect();
        const r = store.read();
        store.save(
          {
            ...r.state,
            sync: {
              ...r.state.sync,
              connection: "disconnected",
              status: "disconnected",
              message: "Disconnected. Journal history preserved.",
            },
          },
          r.revision,
        );
        notify();
      });
      handle("journal:export", async () => {
        const r = await dialog.showSaveDialog(mainWindow, {
          defaultPath: `${product.id}-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: "Journal backup", extensions: ["json"] }],
        });
        if (!r.canceled)
          await fs.writeFile(
            r.filePath,
            JSON.stringify(store.read().state, null, 2),
          );
        return !r.canceled;
      });
      await createWindow();
      diagnostic('Main window loaded');
      if (connected) {
        provider.verifySession().then(refreshConnected).catch(() => {});
      }
      timer = setInterval(() => {
        // Refresh live/changed/incomplete accounts; keep completed archived history cached.
        if (connected) refreshConnected();
      }, 60000);
      commandTimer = setInterval(async () => {
        const commands = store.db
          .prepare(
            "SELECT id,kind FROM commands WHERE status='pending' ORDER BY id LIMIT 1",
          )
          .all();
        for (const cmd of commands) {
          store.db
            .prepare("UPDATE commands SET status='running' WHERE id=?")
            .run(cmd.id);
          try {
            const result =
              cmd.kind === "connect"
                ? await provider.connect()
                : cmd.kind === "sync"
                  ? await synchronize(true)
                  : cmd.kind === 'retry' ? await synchronize(true,true)
                  : { error: "Unknown command" };
            store.db
              .prepare(
                "UPDATE commands SET status='complete',result=? WHERE id=?",
              )
              .run(
                JSON.stringify(
                  result || { message: "Official sign-in opened" },
                ),
                cmd.id,
              );
          } catch (e) {
            store.db
              .prepare("UPDATE commands SET status='error',result=? WHERE id=?")
              .run(JSON.stringify({ error: e.message }), cmd.id);
          }
        }
      }, 2000);
    })
    .catch((e) => {
      console.error('[Journal] Startup failed:', e.message);
      dialog.showErrorBox(
        `${product.name} could not start`,
        e.stack || e.message,
      );
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    clearInterval(timer);
    clearInterval(commandTimer);
  });
  app.on('will-quit', () => {
    // Finish SQLite's WAL checkpoint before the Electron process exits.
    connectionEpoch++;
    store?.close();
  });
}
