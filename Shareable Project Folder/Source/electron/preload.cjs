const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("journal", {
  load: () => ipcRenderer.invoke("journal:load"),
  save: (state, revision) =>
    ipcRenderer.invoke("journal:save", { state, revision }),
  connect: () => ipcRenderer.invoke("provider:connect"),
  sync: () => ipcRenderer.invoke("provider:sync"),
  retry: () => ipcRenderer.invoke("provider:retry"),
  disconnect: () => ipcRenderer.invoke("provider:disconnect"),
  exportBackup: () => ipcRenderer.invoke("journal:export"),
  onChange: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("journal:changed", listener);
    return () => ipcRenderer.removeListener("journal:changed", listener);
  },
});
