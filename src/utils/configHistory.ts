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

  try {
    await writeHistoryBackup(modName, safeConfigName, timestamp, content);
    await cleanupOldBackups(modName, safeConfigName);
  } catch (error) {
    console.error("Electron history write failed:", error);
  }
};

// ✅ GET HISTORY
export const getConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string
): Promise<ConfigHistory[]> => {
  const safeConfigName = configFile.replace(/[<>:"/\\|?*]/g, "_");

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
    console.error("Electron read failed:", error);
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
  } catch (error) {
    console.error("Electron clear failed:", error);
  }
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