import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn, ChildProcess } from 'child_process';
import https from 'https';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 400,
    minHeight: 500,
    title: "SPT Mod Config Editor",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: "#1a1a1a",
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  Menu.setApplicationMenu(null);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // IPC Handler for Fetching Items using native Node.js https
  // This bypasses Chromium's fetch restrictions and SSL/CORS issues
  ipcMain.handle("spt:fetch-items", async () => {
    return new Promise((resolve, reject) => {
      const query = JSON.stringify({
        query: `{
          items(lang: en) {
            id
            name
            shortName
            types
          }
        }`
      });

      const options = {
        hostname: 'tarkov-dev.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SPT-Mod-Config-Editor/1.0.0',
          'Content-Length': Buffer.byteLength(query)
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        console.error("Native fetch error:", e);
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.write(query);
      req.end();
    });
  });

  // IPC Handlers for Launching SPT
  ipcMain.handle("spt:launch", async (_event, { exePath }) => {
    if (!fsSync.existsSync(exePath)) {
      throw new Error(`Executable not found at ${exePath}`);
    }

    const executable = path.basename(exePath);
    const sptPath = path.dirname(exePath);

    try {
      const isServer = executable.toLowerCase().includes('server');
      
      if (isServer) {
        spawn('cmd.exe', ['/c', 'start', '"SPT Server"', executable], {
          cwd: sptPath,
          shell: true,
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        spawn(exePath, [], {
          cwd: sptPath,
          detached: true,
          shell: false,
          stdio: 'ignore'
        }).unref();
      }

      return { success: true };
    } catch (error: any) {
      console.error(`Failed to launch ${executable}:`, error);
      throw new Error(`Failed to launch ${executable}: ${error.message}`);
    }
  });

  ipcMain.handle("spt:getStatus", async (_event, exePath) => {
    return false;
  });

  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select SPT Installation Folder"
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("dialog:selectExe", async (_event, { title, defaultPath }) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      title: title || "Select Executable",
      defaultPath: defaultPath,
      filters: [{ name: 'Executables', extensions: ['exe'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("fs:readdir", async (_event, dirPath) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isFile: e.isFile(),
      isDirectory: e.isDirectory()
    }));
  });

  ipcMain.handle("fs:readFile", async (_event, filePath) => {
    return await fs.readFile(filePath, "utf-8");
  });

  ipcMain.handle("fs:writeFile", async (_event, filePath, content) => {
    await fs.writeFile(filePath, content, "utf-8");
    return true;
  });

  ipcMain.handle("fs:exists", async (_event, filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs:stat", async (_event, targetPath) => {
    const stats = await fs.stat(targetPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size
    };
  });

  ipcMain.handle("fs:readCategoryFile", async () => {
    const categoryPath = path.join(app.getPath("documents"), "SPTModConfigEditor", "UserData", "categories.json");
    if (!fsSync.existsSync(categoryPath)) return null;
    return await fs.readFile(categoryPath, "utf-8");
  });

  ipcMain.handle("fs:writeCategoryFile", async (_event, content) => {
    const userDataDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "UserData");
    await fs.mkdir(userDataDir, { recursive: true });
    await fs.writeFile(path.join(userDataDir, "categories.json"), content, "utf-8");
  });

  ipcMain.handle("fs:writeHistoryBackup", async (_event, modName, configFile, timestamp, content) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `${configFile.replace(/\\|\//g, "_")}_${timestamp}.json`;
    await fs.writeFile(path.join(backupDir, filename), content, "utf-8");
    return { success: true };
  });

  ipcMain.handle("fs:readHistoryBackups", async (_event, modName, configFile) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    if (!fsSync.existsSync(backupDir)) return [];
    
    const entries = await fs.readdir(backupDir);
    const prefix = configFile.replace(/\\|\//g, "_");
    const relevantEntries = entries.filter(name => name.startsWith(prefix));

    const backups = await Promise.all(relevantEntries.map(async (name) => {
      const filePath = path.join(backupDir, name);
      try {
        const [content, stats] = await Promise.all([
          fs.readFile(filePath, "utf-8"),
          fs.stat(filePath)
        ]);
        return { filename: name, timestamp: stats.mtimeMs, content };
      } catch (err) {
        console.error(`Failed to read backup ${name}:`, err);
        return null;
      }
    }));

    return backups.filter(b => b !== null);
  });

  ipcMain.handle("fs:deleteHistoryBackup", async (_event, modName, filename) => {
    const backupPath = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName, filename);
    if (fsSync.existsSync(backupPath)) {
      await fs.unlink(backupPath);
    }
    return { success: true };
  });

  ipcMain.handle("fs:clearHistoryBackups", async (_event, modName, configFile) => {
    const backupDir = path.join(app.getPath("documents"), "SPTModConfigEditor", "History Backups", modName);
    if (!fsSync.existsSync(backupDir)) return { success: true };

    const prefix = configFile.replace(/\\|\//g, "_");
    const entries = await fs.readdir(backupDir);
    const toDelete = entries.filter(name => name.startsWith(prefix));

    await Promise.all(toDelete.map(name => fs.unlink(path.join(backupDir, name))));
    return { success: true };
  });

  ipcMain.handle("dialog:saveFile", async (_event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});