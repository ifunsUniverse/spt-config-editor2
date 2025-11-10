export const selectFolder = () => {
  if (!window.electronBridge?.selectFolder) {
    return Promise.resolve({ canceled: true, path: undefined });
  }
  return window.electronBridge.selectFolder();
};
export const readdir = (path: string) => {
  if (!window.electronBridge?.readdir) {
    return Promise.resolve([]);
  }
  return window.electronBridge.readdir(path);
};

export const readFile = (path: string) => {
  if (!window.electronBridge?.readFile) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.readFile(path);
};

export const writeFile = (path: string, content: string) => {
  if (!window.electronBridge?.writeFile) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.writeFile(path, content);
};

export const exists = (path: string) => {
  if (!window.electronBridge?.exists) {
    return Promise.resolve(false);
  }
  return window.electronBridge.exists(path);
};

export const stat = (path: string) => {
  if (!window.electronBridge?.stat) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.stat(path);
};
// ✅ Categories
export const writeCategoryFile = (content: string) => {
  if (!window.electronBridge?.writeCategoryFile) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.writeCategoryFile(content);
};

export const readCategoryFile = () => {
  if (!window.electronBridge?.readCategoryFile) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.readCategoryFile();
};

export function selectModFolder() {
  return window.electronBridge?.selectFolder();
}

// ✅ History backups
export const writeHistoryBackup = (modName: string, configFile: string, timestamp: number, content: string) => {
  if (!window.electronBridge?.writeHistoryBackup) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.writeHistoryBackup(modName, configFile, timestamp, content);
};

export const readHistoryBackups = (modName: string, configFile: string) => {
  if (!window.electronBridge?.readHistoryBackups) {
    return Promise.resolve([]);
  }
  return window.electronBridge.readHistoryBackups(modName, configFile);
};

export const deleteHistoryBackup = (modName: string, filename: string) => {
  if (!window.electronBridge?.deleteHistoryBackup) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.deleteHistoryBackup(modName, filename);
};

export const clearHistoryBackups = (modName: string, configFile: string) => {
  if (!window.electronBridge?.clearHistoryBackups) {
    return Promise.reject(new Error("Electron bridge not available"));
  }
  return window.electronBridge.clearHistoryBackups(modName, configFile);
};
