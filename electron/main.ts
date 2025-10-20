import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

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

  // Hide the menu bar
  Menu.setApplicationMenu(null);

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
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
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select SPT Installation Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    path: result.filePaths[0],
  };
});

// Read directory contents
ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (error: any) {
    throw new Error(`Failed to read directory: ${error.message}`);
  }
});

// Read file contents
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Write file contents
ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
});

// Check if path exists
ipcMain.handle('fs:exists', async (_event, targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
});

// Get path stats
ipcMain.handle('fs:stat', async (_event, targetPath: string) => {
  try {
    const stats = await fs.stat(targetPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
    };
  } catch (error: any) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }
});

// Get app documents path
ipcMain.handle('app:getDocumentsPath', async () => {
  return app.getPath('documents');
});

// Write history backup to disk
ipcMain.handle('fs:writeHistoryBackup', async (_event, modName: string, configFile: string, timestamp: number, content: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupDir = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    const filename = `${configFile.replace(/\.[^/.]+$/, '')}_${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return { success: true, path: backupPath };
  } catch (error: any) {
    throw new Error(`Failed to write history backup: ${error.message}`);
  }
});

// Read all history backups for a specific mod config
ipcMain.handle('fs:readHistoryBackups', async (_event, modName: string, configFile: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupDir = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName);
    
    try {
      await fs.access(backupDir);
    } catch {
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
  } catch (error: any) {
    throw new Error(`Failed to read history backups: ${error.message}`);
  }
});

// Delete a specific history backup file
ipcMain.handle('fs:deleteHistoryBackup', async (_event, modName: string, filename: string) => {
  try {
    const docsPath = app.getPath('documents');
    const backupPath = path.join(docsPath, 'SPTModConfigEditor', 'History Backups', modName, filename);
    await fs.unlink(backupPath);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to delete history backup: ${error.message}`);
  }
});

// Clear all history backups for a specific config
ipcMain.handle('fs:clearHistoryBackups', async (_event, modName: string, configFile: string) => {
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
  } catch (error: any) {
    throw new Error(`Failed to clear history backups: ${error.message}`);
  }
});
