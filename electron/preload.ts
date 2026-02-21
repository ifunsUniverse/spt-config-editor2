import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  selectExe: (options: { title?: string; defaultPath?: string }) => ipcRenderer.invoke("dialog:selectExe", options),
  readdir: (path: string) => ipcRenderer.invoke("fs:readdir", path),
  readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path),
  writeFile: (path: string, content: any) => ipcRenderer.invoke("fs:writeFile", path, content),
  exists: (path: string) => ipcRenderer.invoke("fs:exists", path),
  stat: (path: string) => ipcRenderer.invoke("fs:stat", path),
  writeCategoryFile: (content: string) => ipcRenderer.invoke("fs:writeCategoryFile", content),
  readCategoryFile: () => ipcRenderer.invoke("fs:readCategoryFile"),
  writeHistoryBackup: (modName: string, configFile: string, timestamp: number, content: string) => 
    ipcRenderer.invoke("fs:writeHistoryBackup", modName, configFile, timestamp, content),
  readHistoryBackups: (modName: string, configFile: string) => 
    ipcRenderer.invoke("fs:readHistoryBackups", modName, configFile),
  deleteHistoryBackup: (modName: string, filename: string) => 
    ipcRenderer.invoke("fs:deleteHistoryBackup", modName, filename),
  clearHistoryBackups: (modName: string, configFile: string) => 
    ipcRenderer.invoke("fs:clearHistoryBackups", modName, configFile),
  saveFile: (options: any) => ipcRenderer.invoke("dialog:saveFile", options),
  // Launching SPT
  launchSPT: (exePath: string) => ipcRenderer.invoke("spt:launch", { exePath }),
  getSPTStatus: (exePath: string) => ipcRenderer.invoke("spt:getStatus", exePath),
  // Item Database (Bypassing CORS)
  fetchTarkovItems: () => ipcRenderer.invoke("spt:fetch-items"),
  onSPTStatusChange: (exePath: string, callback: (running: boolean) => void) => {
    const listener = (_event: any, status: boolean) => callback(status);
    ipcRenderer.on(`spt:status:${exePath}`, listener);
    return () => ipcRenderer.removeListener(`spt:status:${exePath}`, listener);
  },
  onSPTConsoleLog: (exePath: string, callback: (log: string) => void) => {
    const listener = (_event: any, log: string) => callback(log);
    ipcRenderer.on(`spt:console:${exePath}`, listener);
    return () => ipcRenderer.removeListener(`spt:console:${exePath}`, listener);
  }
};

contextBridge.exposeInMainWorld("electronBridge", electronAPI);