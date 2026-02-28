/**
 * This bridge utility connects the React frontend to the Electron main process via window.electronBridge.
 */

const getBridge = () => (window as any).electronBridge;

export const selectFolder = async () => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.selectFolder();
};

export const readdir = async (path: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.readdir(path);
};

export const readFile = async (path: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.readFile(path);
};

export const writeFile = async (path: string, content: any) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.writeFile(path, content);
};

export const exists = async (path: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.exists(path);
};

export const stat = async (path: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.stat(path);
};

export const writeCategoryFile = async (content: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.writeCategoryFile(content);
};

export const readCategoryFile = async () => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.readCategoryFile();
};

export const writeHistoryBackup = async (modName: string, configFile: string, timestamp: number, content: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.writeHistoryBackup(modName, configFile, timestamp, content);
};

export const readHistoryBackups = async (modName: string, configFile: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.readHistoryBackups(modName, configFile);
};

export const deleteHistoryBackup = async (modName: string, filename: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.deleteHistoryBackup(modName, filename);
};

export const clearHistoryBackups = async (modName: string, configFile: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.clearHistoryBackups(modName, configFile);
};

export const saveFile = async (options: any) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Electron bridge not available");
  return await bridge.saveFile(options);
};