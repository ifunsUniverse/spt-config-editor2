import { isElectron, electronAPI } from './electronBridge';

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

const getStorageKey = (modId: string, configFile: string): string => {
  return `spt-config-history-${modId}-${configFile}`;
};

// ========== SAVE HISTORY ==========
export const saveConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string,
  rawJson: any,
  label?: string
): Promise<void> => {
  const timestamp = Date.now();
  const defaultLabel = label || `Auto-save at ${new Date().toLocaleTimeString()}`;

  if (isElectron()) {
    try {
      const api = electronAPI();
      const content = JSON.stringify({
        modId,
        modName,
        configFile,
        timestamp,
        rawJson,
        label: defaultLabel,
      }, null, 2);

      await api.writeHistoryBackup(modName, configFile, timestamp, content);
      await cleanupOldBackups(modName, configFile);
    } catch (error) {
      console.error("Failed to save config history to disk:", error);
      saveToLocalStorage(modId, configFile, rawJson, defaultLabel, timestamp);
    }
  } else {
    saveToLocalStorage(modId, configFile, rawJson, defaultLabel, timestamp);
  }
};

const saveToLocalStorage = (
  modId: string,
  configFile: string,
  rawJson: any,
  label: string,
  timestamp: number
): void => {
  try {
    const key = getStorageKey(modId, configFile);
    const history = getConfigHistoryFromLocalStorage(modId, configFile);
    
    const newEntry: ConfigHistory = {
      modId,
      modName: modId,
      configFile,
      timestamp,
      rawJson,
      label,
    };
    
    const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_PER_CONFIG);
    localStorage.setItem(key, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to save config history to localStorage:", error);
  }
};

const cleanupOldBackups = async (modName: string, configFile: string): Promise<void> => {
  try {
    const api = electronAPI();
    const backups = await api.readHistoryBackups(modName, configFile);
    
    if (backups.length > MAX_HISTORY_PER_CONFIG) {
      const toDelete = backups.slice(MAX_HISTORY_PER_CONFIG);
      for (const backup of toDelete) {
        await api.deleteHistoryBackup(modName, backup.filename);
      }
    }
  } catch (error) {
    console.error("Failed to cleanup old backups:", error);
  }
};

// ========== GET HISTORY ==========
export const getConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string
): Promise<ConfigHistory[]> => {
  if (isElectron()) {
    try {
      const api = electronAPI();
      const backups = await api.readHistoryBackups(modName, configFile);
      
      const maxAge = Date.now() - (MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000);
      return backups
        .filter(backup => backup.timestamp > maxAge)
        .map(backup => ({
          modId,
          modName,
          configFile,
          timestamp: backup.timestamp,
          rawJson: backup.content.rawJson || backup.content,
          label: backup.content.label || `Backup from ${new Date(backup.timestamp).toLocaleString()}`,
          filename: backup.filename,
        }))
        .slice(0, MAX_HISTORY_PER_CONFIG);
    } catch (error) {
      console.error("Failed to load config history from disk:", error);
      return getConfigHistoryFromLocalStorage(modId, configFile);
    }
  } else {
    return getConfigHistoryFromLocalStorage(modId, configFile);
  }
};

const getConfigHistoryFromLocalStorage = (modId: string, configFile: string): ConfigHistory[] => {
  try {
    const key = getStorageKey(modId, configFile);
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    const history: ConfigHistory[] = JSON.parse(stored);
    const maxAge = Date.now() - (MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000);
    return history.filter(entry => entry.timestamp > maxAge);
  } catch (error) {
    console.error("Failed to load config history from localStorage:", error);
    return [];
  }
};

// ========== CLEAR HISTORY ==========
export const clearConfigHistory = async (
  modId: string,
  modName: string,
  configFile: string
): Promise<void> => {
  if (isElectron()) {
    try {
      const api = electronAPI();
      await api.clearHistoryBackups(modName, configFile);
    } catch (error) {
      console.error("Failed to clear config history from disk:", error);
      clearConfigHistoryFromLocalStorage(modId, configFile);
    }
  } else {
    clearConfigHistoryFromLocalStorage(modId, configFile);
  }
};

const clearConfigHistoryFromLocalStorage = (modId: string, configFile: string): void => {
  try {
    const key = getStorageKey(modId, configFile);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear config history from localStorage:", error);
  }
};

// ========== CLEAR ALL HISTORY ==========
export const clearAllHistory = (): void => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('spt-config-history-')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error("Failed to clear all history:", error);
  }
};
