export const readdir = (path: string) =>
  window.electronBridge?.readdir(path);

export const stat = (path: string) =>
  window.electronBridge?.stat(path);

export const exists = (path: string) =>
  window.electronBridge?.exists(path);

export const readFile = (path: string) =>
  window.electronBridge?.readFile(path);

export const selectFolder = async () => {
  if (!window.electronBridge) {
    return { canceled: true, path: undefined };
  }
  return window.electronBridge.selectFolder();
};

export const writeCategoryFile = (json: string) =>
  window.electronBridge?.writeCategoryFile(json);

export const readCategoryFile = () =>
  window.electronBridge?.readCategoryFile();

export const writeHistoryBackup = (modName: string, configFile: string, ts: number, json: string) =>
  window.electronBridge?.writeHistoryBackup(modName, configFile, ts, json);

export const readHistoryBackups = (modName: string, configFile: string) =>
  window.electronBridge?.readHistoryBackups(modName, configFile);

export const clearHistoryBackups = (modName: string, configFile: string) =>
  window.electronBridge?.clearHistoryBackups(modName, configFile);

export const deleteHistoryBackup = (modName: string, filename: string) =>
  window.electronBridge?.deleteHistoryBackup(modName, filename);
