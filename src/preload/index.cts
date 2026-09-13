const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "worth",
  Object.freeze({
    read: () => ipcRenderer.invoke("worth:read"),
    save: (input: unknown) => ipcRenderer.invoke("worth:save", input),
    remove: (id: string) => ipcRenderer.invoke("worth:remove", id),
    currency: (value: string) => ipcRenderer.invoke("worth:currency", value),
    export: (format: string) => ipcRenderer.invoke("worth:export", format),
    importCsv: () => ipcRenderer.invoke("worth:importCsv"),
    restore: () => ipcRenderer.invoke("worth:restore"),
    location: () => ipcRenderer.invoke("worth:location"),
  }),
);
