declare global {
  interface Window {
    electronBridge: {
      selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
      readdir: (path: string) => Promise<any>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<any>;
      exists: (path: string) => Promise<boolean>;
      stat: (path: string) => Promise<any>;
      writeCategoryFile: (json: string) => Promise<any>;
      readCategoryFile: () => Promise<string | null>;
      writeHistoryBackup: (...args: any[]) => Promise<any>;
      readHistoryBackups: (...args: any[]) => Promise<any>;
      deleteHistoryBackup: (...args: any[]) => Promise<any>;
      clearHistoryBackups: (...args: any[]) => Promise<any>;
    };
  }
}
export {};
