import { contextBridge, ipcRenderer } from 'electron';
const electronAPI = {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    stat: (path) => ipcRenderer.invoke('fs:stat', path),
    getDocumentsPath: () => ipcRenderer.invoke('app:getDocumentsPath'),
    writeHistoryBackup: (modName, configFile, timestamp, content) => ipcRenderer.invoke('fs:writeHistoryBackup', modName, configFile, timestamp, content),
    readHistoryBackups: (modName, configFile) => ipcRenderer.invoke('fs:readHistoryBackups', modName, configFile),
    deleteHistoryBackup: (modName, filename) => ipcRenderer.invoke('fs:deleteHistoryBackup', modName, filename),
    clearHistoryBackups: (modName, configFile) => ipcRenderer.invoke('fs:clearHistoryBackups', modName, configFile),
    readCategoryFile: () => ipcRenderer.invoke('fs:readCategoryFile'),
    writeCategoryFile: (content) => ipcRenderer.invoke('fs:writeCategoryFile', content),
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
