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
    electronBridge?: {
      writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => Promise<void>;
      readHistoryBackups: (modName: string, configFile: string) => Promise<any[]>;
      clearHistoryBackups: (modName: string, configFile: string) => Promise<void>;
      deleteHistoryBackup: (modName: string, filename: string) => Promise<void>;
      selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
      writeCategoryFile: (json: string) => Promise<any>;
      readCategoryFile: () => Promise<string | null>;
      readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
      stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
      exists: (path: string) => Promise<boolean>;
      readFile: (path: string) => Promise<string>;
    };
  }
}
