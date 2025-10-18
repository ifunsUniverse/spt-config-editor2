export interface ElectronAPI {
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
