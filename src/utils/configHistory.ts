export interface ConfigHistory {
  modId: string;
  configFile: string;
  timestamp: number;
  rawJson: any;
  label?: string;
}

const MAX_HISTORY_PER_CONFIG = 10;
const MAX_HISTORY_AGE_DAYS = 30;

const getStorageKey = (modId: string, configFile: string): string => {
  return `spt-config-history-${modId}-${configFile}`;
};

export const saveConfigHistory = (
  modId: string,
  configFile: string,
  rawJson: any,
  label?: string
): void => {
  try {
    const key = getStorageKey(modId, configFile);
    const history = getConfigHistory(modId, configFile);
    
    const newEntry: ConfigHistory = {
      modId,
      configFile,
      timestamp: Date.now(),
      rawJson,
      label: label || `Auto-save at ${new Date().toLocaleTimeString()}`
    };
    
    // Add new entry and limit to MAX_HISTORY_PER_CONFIG
    const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_PER_CONFIG);
    
    localStorage.setItem(key, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to save config history:", error);
  }
};

export const getConfigHistory = (modId: string, configFile: string): ConfigHistory[] => {
  try {
    const key = getStorageKey(modId, configFile);
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    const history: ConfigHistory[] = JSON.parse(stored);
    
    // Filter out entries older than MAX_HISTORY_AGE_DAYS
    const maxAge = Date.now() - (MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000);
    return history.filter(entry => entry.timestamp > maxAge);
  } catch (error) {
    console.error("Failed to load config history:", error);
    return [];
  }
};

export const clearConfigHistory = (modId: string, configFile: string): void => {
  try {
    const key = getStorageKey(modId, configFile);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear config history:", error);
  }
};

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
