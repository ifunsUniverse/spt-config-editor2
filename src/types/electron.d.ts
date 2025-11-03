declare global {
  interface Window {
    electronBridge?: {
      selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
      readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
      stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
      exists: (path: string) => Promise<boolean>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
      writeCategoryFile: (json: string) => Promise<any>;
      readCategoryFile: () => Promise<string | null>;
      writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => Promise<void>;
      readHistoryBackups: (modName: string, configFile: string) => Promise<any[]>;
      clearHistoryBackups: (modName: string, configFile: string) => Promise<void>;
      deleteHistoryBackup: (modName: string, filename: string) => Promise<void>;
    };
  }
}

export {};
