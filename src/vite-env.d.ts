/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_OWNER_EMAILS?: string;
  readonly VITE_OWNER_USERNAMES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ElectronBridgeApi {
  // Generic allowlisted invoke (used by bridge internals)
  invoke: (channel: string, payload?: Record<string, unknown> | string) => Promise<any>;

  // Dialog
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  selectExecutable: (title?: string, defaultPath?: string) => Promise<{ canceled: boolean; path?: string }>;

  // File system
  readDir: (path: string) => Promise<Array<{ name: string; kind: "file" | "directory" }>>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, content: string) => Promise<boolean>;
  readBinary: (path: string) => Promise<number[]>;
  writeBinary: (path: string, data: number[]) => Promise<boolean>;
  mkdir: (path: string) => Promise<boolean>;
  exists: (path: string, kind: "file" | "directory") => Promise<boolean>;
  ensureFile: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<boolean>;

  // App store
  storeWrite: (key: string, content: string) => Promise<boolean>;
  storeRead: (key: string) => Promise<string | null>;

  // Config history
  historyWrite: (modName: string, configFile: string, timestamp: number, content: string) => Promise<{ filename: string }>;
  historyRead: (modName: string, configFile: string) => Promise<Array<{ filename: string; timestamp: number; content: string }>>;
  historyDelete: (modName: string, filename: string) => Promise<boolean>;
  historyClear: (modName: string, configFile: string) => Promise<boolean>;

  // File save dialog
  fileSave: (suggestedName: string, data: number[]) => Promise<{ canceled: boolean; path?: string }>;

  // Shell — opens URL in the user's default browser
  openExternal: (url: string) => Promise<boolean>;
  launchExecutable: (path: string, args?: string[], options?: { openInTerminal?: boolean }) => Promise<boolean>;
}

interface Window {
  sptElectron?: ElectronBridgeApi;
}
