export const selectFolder = () => {
  if (!window.electronBridge?.selectFolder) {
    return Promise.resolve({ canceled: true, path: undefined });
  }
  return window.electronBridge.selectFolder();
};
export const readdir = (path: string) => window.electronBridge?.readdir(path);
export const readFile = (path: string) => window.electronBridge?.readFile(path);
export const writeFile = (path: string, content: string) =>
  window.electronBridge?.writeFile(path, content);
export const exists = (path: string) => window.electronBridge?.exists(path);
export const stat = (path: string) => window.electronBridge?.stat(path);
// ✅ Categories
export const writeCategoryFile = (content: string) =>
  window.electronBridge?.writeCategoryFile(content);
export const readCategoryFile = () => window.electronBridge?.readCategoryFile();
export function selectModFolder() {
  return window.electronBridge?.selectFolder();
}
// ✅ History backups
export const writeHistoryBackup = (modName: string, configFile: string, timestamp: number, content: string) =>
  window.electronBridge?.writeHistoryBackup(modName, configFile, timestamp, content);
export const readHistoryBackups = (modName: string, configFile: string) =>
  window.electronBridge?.readHistoryBackups(modName, configFile);
export const deleteHistoryBackup = (modName: string, filename: string) =>
  window.electronBridge?.deleteHistoryBackup(modName, filename);
export const clearHistoryBackups = (modName: string, configFile: string) =>
  window.electronBridge?.clearHistoryBackups(modName, configFile);
