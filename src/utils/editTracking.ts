export interface ModEditHistory {
  modId: string;
  configFile: string;
  timestamp: number;
}

const STORAGE_KEY = "spt-mod-edit-history";
const MAX_HISTORY_ENTRIES = 100;

export const saveEditHistory = (modId: string, configFile: string): void => {
  try {
    const history = getEditHistory();
    
    // Remove existing entry for this mod+config if it exists
    const filtered = history.filter(
      entry => !(entry.modId === modId && entry.configFile === configFile)
    );
    
    // Add new entry at the beginning
    const newEntry: ModEditHistory = {
      modId,
      configFile,
      timestamp: Date.now()
    };
    
    const updatedHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to save edit history:", error);
  }
};

export const getEditHistory = (): ModEditHistory[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load edit history:", error);
    return [];
  }
};

export const getModEditTime = (modId: string, configFile?: string): number | null => {
  const history = getEditHistory();
  
  if (configFile) {
    // Find specific config file edit time
    const entry = history.find(
      h => h.modId === modId && h.configFile === configFile
    );
    return entry ? entry.timestamp : null;
  } else {
    // Find most recent edit time for any config in this mod
    const modEntries = history.filter(h => h.modId === modId);
    if (modEntries.length === 0) return null;
    return Math.max(...modEntries.map(e => e.timestamp));
  }
};

export const clearEditHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear edit history:", error);
  }
};
