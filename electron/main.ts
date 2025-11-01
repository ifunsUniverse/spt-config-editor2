import type { Dirent } from 'fs';
import type { IpcMainInvokeEvent } from 'electron';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let mainWindow: ReturnType<typeof BrowserWindow> | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'SPT Mod Config Editor',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#1a1a1a',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
  mainWindow.show(); // ← only show when ready
});

  // Hide the menu bar
  Menu.setApplicationMenu(null);

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  
  // Setup category handlers
  ipcMain.handle('fs:readCategoryFile', async (_event: IpcMainInvokeEvent) => {
    try {
      const docsPath = app.getPath('documents');
      const categoryPath = path.join(docsPath, 'SPTModConfigEditor', 'UserData', 'categories.json');
      
      if (!fsSync.existsSync(categoryPath)) {
        return null;
      }
      
      const content = await fs.readFile(categoryPath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read category file:', error);
      return null;
    }
  });

  ipcMain.handle('fs:writeCategoryFile', async (_event: IpcMainInvokeEvent, content: string) => {
    try {
      const docsPath = app.getPath('documents');
      const userDataDir = path.join(docsPath, 'SPTModConfigEditor', 'UserData');
      const categoryPath = path.join(userDataDir, 'categories.json');
      
      await fs.mkdir(userDataDir, { recursive: true });
      await fs.writeFile(categoryPath, content, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write category file: ${message}`);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Select folder dialog
ipcMain.handle("dialog:selectFolder", async (_event: IpcMainInvokeEvent) => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select SPT Installation Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, path: result.filePaths[0] };
});


// Read directory contents
ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    isFile: e.isFile(),
    isDirectory: e.isDirectory(),
  }));
});

// Read file contents
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data;
  } catch (err) {
    console.error('Failed to read file:', err);
    throw err;
  }
});

// Write file contents
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

// Check if path exists
ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Get path stats
ipcMain.handle('fs:stat', async (_event: IpcMainInvokeEvent, targetPath: string) => {
  try {
    const stats = await fs.stat(targetPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get stats: ${message}`);
  }
});

// Get app documents path
ipcMain.handle('app:getDocumentsPath', async (_event: IpcMainInvokeEvent) => {
  return app.getPath('documents');
});

// Write history backup to disk
ipcMain.handle('fs:writeHistoryBackup', async (_event: IpcMainInvokeEvent, modName: string, configFile: string, timestamp: number, content: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupDir = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    const filename = `${configFile.replace(/\.[^/.]+$/, '')}_${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return { success: true, path: backupPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to write history backup: ${message}`);
  }
});

// Read all history backups for a specific mod config
ipcMain.handle('fs:readHistoryBackups', async (_event: IpcMainInvokeEvent, modName: string, configFile: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupDir = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName);
    
    if (!fsSync.existsSync(backupDir)) {
      return [];
    }
    
    const configPrefix = configFile.replace(/\.[^/.]+$/, '');
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    
    const backups = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith(configPrefix) && entry.name.endsWith('.json')) {
        const filePath = path.join(backupDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        const match = entry.name.match(/_(\d+)\.json$/);
        const timestamp = match ? parseInt(match[1]) : stats.mtimeMs;
        
        backups.push({
          filename: entry.name,
          timestamp,
          content: JSON.parse(content),
          size: stats.size,
        });
      }
    }
    
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read history backups: ${message}`);
  }
});

// Delete a specific history backup file
ipcMain.handle('fs:deleteHistoryBackup', async (_event: IpcMainInvokeEvent, modName: string, filename: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupPath = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName, filename);
    await fs.unlink(backupPath);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete history backup: ${message}`);
  }
});

// Clear all history backups for a specific config
ipcMain.handle('fs:clearHistoryBackups', async (_event: IpcMainInvokeEvent, modName: string, configFile: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupDir = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName);
    
    const configPrefix = configFile.replace(/\.[^/.]+$/, '');
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith(configPrefix)) {
        await fs.unlink(path.join(backupDir, entry.name));
      }
    }
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to clear history backups: ${message}`);
  }
});
