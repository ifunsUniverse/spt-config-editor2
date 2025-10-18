import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  readdir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number }>;
}

const electronAPI: ElectronAPI = {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
