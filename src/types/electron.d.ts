export interface ElectronAPI {
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
  getDocumentsPath: () => Promise<string>;
  readCategoryFile: () => Promise<string | null>;
  writeCategoryFile: (content: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}export interface HistoryBackup {
  filename: string;
  timestamp: number;
  content: any;
  size: number;
}

export interface ElectronAPI {
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
  getDocumentsPath: () => Promise<string>;
  writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => Promise<void>;
  readHistoryBackups: (modName: string, configFile: string) => Promise<HistoryBackup[]>;
  deleteHistoryBackup: (modName: string, filename: string) => Promise<void>;
  clearHistoryBackups: (modName: string, configFile: string) => Promise<void>;
  readCategoryFile: () => Promise<string | null>;
  writeCategoryFile: (content: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

