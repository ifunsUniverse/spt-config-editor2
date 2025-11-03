import {
  writeHistoryBackup,
  readHistoryBackups,
  clearHistoryBackups,
  deleteHistoryBackup
} from "@/utils/electronBridge";

export interface ConfigHistory {
  modId: string;
  modName: string;
  configFile: string;
  timestamp: number;
  rawJson: any;
  label?: string;
  filename?: string;
}

const MAX_HISTORY_PER_CONFIG = 10;
const MAX_HISTORY_AGE_DAYS = 30;

const getStorageKey = (modId: string, configFile: string): string =>
  `spt-config-history-${modId}-${configFile}`;

// ✅ SAVE HISTORY
export const saveConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string,
  rawJson: any,
  label?: string
): Promise<void> => {

  const timestamp = Date.now();
  const safeConfigName = configFile.replace(/[<>:"/\\|?*]/g, "_");
  const content = JSON.stringify({ rawJson, label }, null, 2);

  const entry: ConfigHistory = {
    modId,
    modName,
    configFile,
    timestamp,
    rawJson,
    label: label || `Auto-save at ${new Date().toLocaleTimeString()}`
  };

  // Try Electron first
  try {
    await writeHistoryBackup(modName, safeConfigName, timestamp, content);
    await cleanupOldBackups(modName, safeConfigName);
    return;
  } catch (error) {
    console.warn("Electron history write failed, falling back to localStorage:", error);
  }

  // Fallback: LOCALSTORAGE
  try {
    const key = getStorageKey(modId, configFile);
    const existing = JSON.parse(localStorage.getItem(key) || "[]") as ConfigHistory[];

    const updated = [entry, ...existing]
      .filter(e => Date.now() - e.timestamp < MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000)
      .slice(0, MAX_HISTORY_PER_CONFIG);

    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save config history to localStorage:", err);
  }
};

// ✅ GET HISTORY
export const getConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string
): Promise<ConfigHistory[]> => {

  const safeConfigName = configFile.replace(/[<>:"/\\|?*]/g, "_");

  // Try Electron first
  try {
    const backups = await readHistoryBackups(modName, safeConfigName);
    const maxAge = Date.now() - MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000;

    return backups
      .filter(b => b.timestamp > maxAge)
      .map(b => ({
        modId,
        modName,
        configFile,
        timestamp: b.timestamp,
        rawJson: JSON.parse(b.content).rawJson,
        label: JSON.parse(b.content).label || `Backup from ${new Date(b.timestamp).toLocaleString()}`,
        filename: b.filename,
      }))
      .slice(0, MAX_HISTORY_PER_CONFIG);
  } catch (error) {
    console.warn("Electron read failed, falling back to localStorage:", error);
  }

  // Fallback: LOCALSTORAGE
  try {
    const key = getStorageKey(modId, configFile);
    const data = JSON.parse(localStorage.getItem(key) || "[]") as ConfigHistory[];
    const maxAge = Date.now() - MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000;

    return data.filter(e => e.timestamp > maxAge).slice(0, MAX_HISTORY_PER_CONFIG);
  } catch (err) {
    console.error("Failed to read config history from localStorage:", err);
    return [];
  }
};

// ✅ CLEAR HISTORY
export const clearConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string
): Promise<void> => {

  try {
    const safeConfigName = configFile.replace(/[<>:"/\\|?*]/g, "_");
    await clearHistoryBackups(modName, safeConfigName);
    return;
  } catch (error) {
    console.warn("Electron clear failed, falling back to localStorage:", error);
  }

  // LOCALSTORAGE fallback
  localStorage.removeItem(getStorageKey(modId, configFile));
};

// ✅ CLEANUP OLD BACKUPS (Electron only)
const cleanupOldBackups = async (modName: string, safeConfigName: string): Promise<void> => {
  try {
    const backups = await readHistoryBackups(modName, safeConfigName);

    if (backups.length > MAX_HISTORY_PER_CONFIG) {
      const toDelete = backups.slice(MAX_HISTORY_PER_CONFIG);
      for (const b of toDelete) {
        await deleteHistoryBackup(modName, b.filename);
      }
    }
  } catch (error) {
    console.error("Failed to cleanup old backups:", error);
  }
};
