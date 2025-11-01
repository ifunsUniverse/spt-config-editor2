const { contextBridge, ipcRenderer } = require('electron');

export interface ElectronAPI {
  selectFolder: () => Promise<{ canceled: boolean; path?: string }>;
  readdir: (path: string) => Promise<any[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<any>;
  getDocumentsPath: () => Promise<string>;
  writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => Promise<void>;
  readHistoryBackups: (modName: string, configFile: string) => Promise<Array<{ filename: string; timestamp: number; content: any; size: number }>>;
  deleteHistoryBackup: (modName: string, filename: string) => Promise<void>;
  clearHistoryBackups: (modName: string, configFile: string) => Promise<void>;
  readCategoryFile: () => Promise<string>;
  writeCategoryFile: (content: string) => Promise<void>;
}

const electronAPI: ElectronAPI = {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
  getDocumentsPath: () => ipcRenderer.invoke('app:getDocumentsPath'),
  writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => 
    ipcRenderer.invoke('fs:writeHistoryBackup', modName, configFile, timestamp, content),
  readHistoryBackups: (modName: string, configFile: string) => 
    ipcRenderer.invoke('fs:readHistoryBackups', modName, configFile),
  deleteHistoryBackup: (modName: string, filename: string) => 
    ipcRenderer.invoke('fs:deleteHistoryBackup', modName, filename),
  clearHistoryBackups: (modName: string, configFile: string) => 
    ipcRenderer.invoke('fs:clearHistoryBackups', modName, configFile),
  readCategoryFile: () => ipcRenderer.invoke('fs:readCategoryFile'),
  writeCategoryFile: (content: string) => ipcRenderer.invoke('fs:writeCategoryFile', content),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
