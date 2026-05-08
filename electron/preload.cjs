const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = [
  "dialog:selectFolder",
  "dialog:selectExecutable",
  "fs:readDir",
  "fs:readText",
  "fs:writeText",
  "fs:readBinary",
  "fs:writeBinary",
  "fs:mkdir",
  "fs:exists",
  "fs:ensureFile",
  "fs:remove",
  "store:write",
  "store:read",
  "history:write",
  "history:read",
  "history:delete",
  "history:clear",
  "file:save",
  "shell:openExternal",
  "app:launchExecutable",
];

contextBridge.exposeInMainWorld("sptElectron", {
  // Generic invoke — allowlisted for backward-compat with the bridge layer
  invoke: (channel, payload) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },

  // ── Dialog ──────────────────────────────────────────────────
  selectFolder: () =>
    ipcRenderer.invoke("dialog:selectFolder"),
  selectExecutable: (title, defaultPath) =>
    ipcRenderer.invoke("dialog:selectExecutable", { title, defaultPath }),

  // ── File system ─────────────────────────────────────────────
  readDir: (path) =>
    ipcRenderer.invoke("fs:readDir", { path }),
  readText: (path) =>
    ipcRenderer.invoke("fs:readText", { path }),
  writeText: (path, content) =>
    ipcRenderer.invoke("fs:writeText", { path, content }),
  readBinary: (path) =>
    ipcRenderer.invoke("fs:readBinary", { path }),
  writeBinary: (path, data) =>
    ipcRenderer.invoke("fs:writeBinary", { path, data }),
  mkdir: (path) =>
    ipcRenderer.invoke("fs:mkdir", { path }),
  exists: (path, kind) =>
    ipcRenderer.invoke("fs:exists", { path, kind }),
  ensureFile: (path) =>
    ipcRenderer.invoke("fs:ensureFile", { path }),
  remove: (path) =>
    ipcRenderer.invoke("fs:remove", { path }),

  // ── App store ───────────────────────────────────────────────
  storeWrite: (key, content) =>
    ipcRenderer.invoke("store:write", { key, content }),
  storeRead: (key) =>
    ipcRenderer.invoke("store:read", { key }),

  // ── Config history ──────────────────────────────────────────
  historyWrite: (modName, configFile, timestamp, content) =>
    ipcRenderer.invoke("history:write", { modName, configFile, timestamp, content }),
  historyRead: (modName, configFile) =>
    ipcRenderer.invoke("history:read", { modName, configFile }),
  historyDelete: (modName, filename) =>
    ipcRenderer.invoke("history:delete", { modName, filename }),
  historyClear: (modName, configFile) =>
    ipcRenderer.invoke("history:clear", { modName, configFile }),

  // ── File save dialog ────────────────────────────────────────
  fileSave: (suggestedName, data) =>
    ipcRenderer.invoke("file:save", { suggestedName, data }),

  // ── Shell ───────────────────────────────────────────────────
  // Opens a URL in the user's default browser (not a new Electron window)
  openExternal: (url) =>
    ipcRenderer.invoke("shell:openExternal", url),

  // ── App launch ─────────────────────────────────────────────
  launchExecutable: (path, args, options) =>
    ipcRenderer.invoke("app:launchExecutable", {
      path,
      args,
      openInTerminal: Boolean(options && options.openInTerminal),
    }),
});
