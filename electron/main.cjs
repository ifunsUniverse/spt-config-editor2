
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const { spawn } = require("child_process");

const APP_STORE_FILE = "app-store.json";

function getStorePath() {
  return path.join(app.getPath("userData"), APP_STORE_FILE);
}

async function readStore() {
  const p = getStorePath();
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeStore(store) {
  const p = getStorePath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(store, null, 2), "utf8");
}

function safeSegment(input) {
  return String(input || "").replace(/[<>:"/\\|?*]/g, "_");
}

function getHistoryRoot() {
  return path.join(app.getPath("userData"), "history");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0b1220",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    // Opt-in only: opening DevTools can emit protocol noise in some Electron builds.
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("dialog:selectExecutable", async (_event, payload) => {
  const result = await dialog.showOpenDialog({
    title: payload?.title || "Select executable",
    defaultPath: payload?.defaultPath || undefined,
    properties: ["openFile"],
    filters: [
      { name: "Executable or Shortcut", extensions: ["exe", "lnk"] },
      { name: "Executable", extensions: ["exe"] },
      { name: "Shortcut", extensions: ["lnk"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("fs:readDir", async (_event, payload) => {
  const dirPath = payload.path;
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? "directory" : "file",
  }));
});

ipcMain.handle("fs:readText", async (_event, payload) => {
  return fsp.readFile(payload.path, "utf8");
});

ipcMain.handle("fs:writeText", async (_event, payload) => {
  await fsp.writeFile(payload.path, payload.content, "utf8");
  return true;
});

ipcMain.handle("fs:readBinary", async (_event, payload) => {
  const buf = await fsp.readFile(payload.path);
  return Array.from(buf);
});

ipcMain.handle("fs:writeBinary", async (_event, payload) => {
  await fsp.writeFile(payload.path, Buffer.from(payload.data));
  return true;
});

ipcMain.handle("fs:mkdir", async (_event, payload) => {
  await fsp.mkdir(payload.path, { recursive: true });
  return true;
});

ipcMain.handle("fs:exists", async (_event, payload) => {
  const targetPath = payload.path;
  const kind = payload.kind;
  try {
    const stat = await fsp.stat(targetPath);
    if (kind === "directory") return stat.isDirectory();
    return stat.isFile();
  } catch {
    return false;
  }
});

ipcMain.handle("fs:ensureFile", async (_event, payload) => {
  const targetPath = payload.path;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(targetPath)) {
    await fsp.writeFile(targetPath, "", "utf8");
  }
  return true;
});

ipcMain.handle("fs:remove", async (_event, payload) => {
  await fsp.rm(payload.path, { recursive: true, force: true });
  return true;
});

ipcMain.handle("store:write", async (_event, payload) => {
  const store = await readStore();
  store[payload.key] = payload.content;
  await writeStore(store);
  return true;
});

ipcMain.handle("store:read", async (_event, payload) => {
  const store = await readStore();
  return store[payload.key] ?? null;
});

ipcMain.handle("history:write", async (_event, payload) => {
  const modFolder = safeSegment(payload.modName);
  const configFile = safeSegment(payload.configFile);
  const filename = `${configFile}_${payload.timestamp}.json`;
  const target = path.join(getHistoryRoot(), modFolder, filename);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, payload.content, "utf8");
  return { filename };
});

ipcMain.handle("history:read", async (_event, payload) => {
  const modFolder = safeSegment(payload.modName);
  const configFile = safeSegment(payload.configFile);
  const modPath = path.join(getHistoryRoot(), modFolder);

  try {
    const files = await fsp.readdir(modPath);
    const matched = files
      .filter((f) => f.startsWith(`${configFile}_`) && f.endsWith(".json"))
      .map((filename) => {
        const tsText = filename.replace(`${configFile}_`, "").replace(".json", "");
        const timestamp = Number(tsText) || 0;
        return { filename, timestamp };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    const results = [];
    for (const item of matched) {
      const p = path.join(modPath, item.filename);
      const content = await fsp.readFile(p, "utf8");
      results.push({ filename: item.filename, timestamp: item.timestamp, content });
    }
    return results;
  } catch {
    return [];
  }
});

ipcMain.handle("history:delete", async (_event, payload) => {
  const modFolder = safeSegment(payload.modName);
  const target = path.join(getHistoryRoot(), modFolder, payload.filename);
  try {
    await fsp.unlink(target);
  } catch {
    return false;
  }
  return true;
});

ipcMain.handle("history:clear", async (_event, payload) => {
  const modFolder = safeSegment(payload.modName);
  const configFile = safeSegment(payload.configFile);
  const modPath = path.join(getHistoryRoot(), modFolder);

  try {
    const files = await fsp.readdir(modPath);
    const targets = files.filter((f) => f.startsWith(`${configFile}_`) && f.endsWith(".json"));
    for (const filename of targets) {
      await fsp.unlink(path.join(modPath, filename));
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("file:save", async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.suggestedName || "file",
    filters: [
      { name: "ZIP Files", extensions: ["zip"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fsp.writeFile(result.filePath, Buffer.from(payload.data));
  return { canceled: false, path: result.filePath };
});

ipcMain.handle("shell:openExternal", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle("app:launchExecutable", async (_event, payload) => {
  const executablePath = payload?.path;
  const args = Array.isArray(payload?.args) ? payload.args : [];
  const openInTerminal = Boolean(payload?.openInTerminal);

  if (!executablePath || typeof executablePath !== "string") {
    throw new Error("Missing executable path");
  }

  const absolutePath = path.win32.normalize(path.resolve(executablePath));
  const extension = path.extname(absolutePath).toLowerCase();
  try {
    const stat = await fsp.stat(absolutePath);
    if (!stat.isFile()) {
      throw new Error("Executable path is not a file");
    }
  } catch {
    throw new Error("Executable file does not exist");
  }

  if (extension === ".lnk") {
    if (openInTerminal) {
      const terminalCommand = `cd /d "${path.dirname(absolutePath)}" && start "" "${absolutePath}"`;
      const terminalChild = spawn("cmd.exe", ["/d", "/k", terminalCommand], {
        cwd: path.dirname(absolutePath),
        detached: true,
        stdio: "ignore",
        windowsHide: false,
        shell: false,
      });
      terminalChild.unref();
      return true;
    }

    const openResult = await shell.openPath(absolutePath);
    if (openResult) {
      throw new Error(openResult);
    }
    return true;
  }

  if (openInTerminal) {
    const safeArgs = args
      .map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`)
      .join(" ");
    const terminalCommand = `cd /d "${path.dirname(absolutePath)}" && "${absolutePath}" ${safeArgs}`.trim();
    const child = spawn("cmd.exe", ["/d", "/k", terminalCommand], {
      cwd: path.dirname(absolutePath),
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false,
    });
    child.unref();
    return true;
  }

  const child = spawn(absolutePath, args, {
    cwd: path.dirname(absolutePath),
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    shell: false,
  });
  child.unref();
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
