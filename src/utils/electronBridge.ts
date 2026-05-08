let rootDirHandle: FileSystemDirectoryHandle | ElectronDirectoryHandle | null = null;
let rootPath = "";

const LAST_SPT_FOLDER_KEY = "lastSPTFolder";
const LAST_SPT_FOLDER_PATH_KEY = "lastSPTFolderPath";

const isElectronRuntime = (): boolean => Boolean(window.sptElectron?.invoke);

const toUint8Array = async (content: unknown): Promise<Uint8Array> => {
  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (content instanceof Blob) {
    return new Uint8Array(await content.arrayBuffer());
  }
  return new TextEncoder().encode(String(content ?? ""));
};

const decodeBytes = (bytes: any): Uint8Array => {
  if (bytes instanceof Uint8Array) return bytes;
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (bytes?.type === "Buffer" && Array.isArray(bytes.data)) return new Uint8Array(bytes.data);
  return new Uint8Array();
};

export class ElectronFileHandle {
  kind: "file" = "file";
  name: string;
  path: string;

  constructor(filePath: string) {
    this.path = filePath;
    const parts = filePath.replace(/\\/g, "/").split("/");
    this.name = parts[parts.length - 1] || filePath;
  }

  async getFile(): Promise<File> {
    const raw = await window.sptElectron!.invoke("fs:readBinary", { path: this.path });
    const bytes = decodeBytes(raw);
    return new File([bytes as BlobPart], this.name);
  }

  async createWritable() {
    return {
      write: async (content: unknown) => {
        const bytes = await toUint8Array(content);
        await window.sptElectron!.invoke("fs:writeBinary", { path: this.path, data: Array.from(bytes) });
      },
      close: async () => {
        return;
      },
    };
  }
}

export class ElectronDirectoryHandle {
  kind: "directory" = "directory";
  name: string;
  path: string;

  constructor(dirPath: string) {
    this.path = dirPath;
    const normalized = dirPath.replace(/\\/g, "/").split("/").filter(Boolean);
    this.name = normalized[normalized.length - 1] || dirPath;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<ElectronDirectoryHandle> {
    const childPath = this.path.replace(/[\\/]$/, "") + "/" + name;
    if (options?.create) {
      await window.sptElectron!.invoke("fs:mkdir", { path: childPath });
      return new ElectronDirectoryHandle(childPath);
    }
    const exists = await window.sptElectron!.invoke("fs:exists", { path: childPath, kind: "directory" });
    if (!exists) throw new Error(`Directory not found: ${name}`);
    return new ElectronDirectoryHandle(childPath);
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<ElectronFileHandle> {
    const childPath = this.path.replace(/[\\/]$/, "") + "/" + name;
    if (options?.create) {
      await window.sptElectron!.invoke("fs:ensureFile", { path: childPath });
      return new ElectronFileHandle(childPath);
    }
    const exists = await window.sptElectron!.invoke("fs:exists", { path: childPath, kind: "file" });
    if (!exists) throw new Error(`File not found: ${name}`);
    return new ElectronFileHandle(childPath);
  }

  async *entries(): AsyncIterableIterator<[string, ElectronDirectoryHandle | ElectronFileHandle]> {
    const entries = await window.sptElectron!.invoke("fs:readDir", { path: this.path });
    for (const entry of entries) {
      const childPath = this.path.replace(/[\\/]$/, "") + "/" + entry.name;
      if (entry.kind === "directory") {
        yield [entry.name, new ElectronDirectoryHandle(childPath)];
      } else {
        yield [entry.name, new ElectronFileHandle(childPath)];
      }
    }
  }
}

export const setRootHandle = (handle: FileSystemDirectoryHandle | ElectronDirectoryHandle, path: string) => {
  rootDirHandle = handle;
  rootPath = path;
};

export const getRootHandle = () => rootDirHandle;
export const getRootPath = () => rootPath;

export type DirectoryHandleLike = FileSystemDirectoryHandle | ElectronDirectoryHandle;

export const rememberLastSelectedFolder = (
  handle: DirectoryHandleLike,
  path?: string
) => {
  localStorage.setItem(LAST_SPT_FOLDER_KEY, handle.name);

  const resolvedPath = path ?? (handle instanceof ElectronDirectoryHandle ? handle.path : undefined);
  if (resolvedPath) {
    localStorage.setItem(LAST_SPT_FOLDER_PATH_KEY, resolvedPath);
  }
};

export const selectFolder = async (): Promise<{ canceled: boolean; path?: string; handle?: DirectoryHandleLike }> => {
  if (isElectronRuntime()) {
    const result = await window.sptElectron!.invoke("dialog:selectFolder");
    if (result?.canceled || !result?.path) return { canceled: true };
    const handle = new ElectronDirectoryHandle(result.path);
    rootDirHandle = handle;
    rootPath = handle.name;
    return { canceled: false, path: result.path, handle };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    rootDirHandle = handle;
    rootPath = handle.name;
    return { canceled: false, path: handle.name, handle };
  } catch (err: any) {
    if (err.name === "AbortError") return { canceled: true };
    throw err;
  }
};

export const selectExecutable = async (
  title: string,
  defaultPath?: string
): Promise<{ canceled: boolean; path?: string }> => {
  if (!isElectronRuntime()) {
    return { canceled: true };
  }

  return window.sptElectron!.invoke("dialog:selectExecutable", { title, defaultPath });
};

export const launchExecutable = async (
  exePath: string,
  args: string[] = [],
  options?: { openInTerminal?: boolean }
): Promise<boolean> => {
  if (!isElectronRuntime()) {
    return false;
  }

  return window.sptElectron!.invoke("app:launchExecutable", {
    path: exePath,
    args,
    openInTerminal: Boolean(options?.openInTerminal),
  });
};

export const loadLastSelectedFolder = async (): Promise<{ canceled: boolean; path?: string; handle?: DirectoryHandleLike }> => {
  // 1. Already have an in-memory handle from this session — use it instantly.
  if (rootDirHandle) {
    return { canceled: false, path: rootPath || undefined, handle: rootDirHandle };
  }

  // 2. Full path was persisted — restore without a dialog.
  if (isElectronRuntime()) {
    const savedPath = localStorage.getItem(LAST_SPT_FOLDER_PATH_KEY);
    if (savedPath) {
      const exists = await window.sptElectron!.invoke("fs:exists", { path: savedPath, kind: "directory" });
      if (exists) {
        const handle = new ElectronDirectoryHandle(savedPath);
        rootDirHandle = handle;
        rootPath = savedPath;
        rememberLastSelectedFolder(handle, savedPath);
        return { canceled: false, path: savedPath, handle };
      }
      // Path saved but folder is gone — fall through to dialog.
      localStorage.removeItem(LAST_SPT_FOLDER_PATH_KEY);
    }
  }

  // 3. No saved path yet (or path is gone) — open the chooser so the user can
  //    pick once; the path will be stored for all future clicks.
  return selectFolder();
};

/**
 * Resolve a subdirectory handle from a path relative to a parent handle.
 */
async function resolveDir(
  base: FileSystemDirectoryHandle | ElectronDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemDirectoryHandle | ElectronDirectoryHandle> {
  let current = base;
  for (const part of pathParts) {
    if (!part) continue;
    current = await current.getDirectoryHandle(part);
  }
  return current;
}

/**
 * Resolve a file handle from a path relative to a parent handle.
 */
async function resolveFile(
  base: FileSystemDirectoryHandle | ElectronDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemFileHandle | ElectronFileHandle> {
  const dirParts = pathParts.slice(0, -1);
  const fileName = pathParts[pathParts.length - 1];
  const dir = await resolveDir(base, dirParts);
  return dir.getFileHandle(fileName);
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export const readdir = async (dirHandle: FileSystemDirectoryHandle | ElectronDirectoryHandle): Promise<DirEntry[]> => {
  const entries: DirEntry[] = [];
  for await (const [name, handle] of (dirHandle as any).entries()) {
    entries.push({
      name,
      isFile: handle.kind === "file",
      isDirectory: handle.kind === "directory",
    });
  }
  return entries;
};

export const readFile = async (fileHandle: FileSystemFileHandle | ElectronFileHandle): Promise<string> => {
  if (isElectronRuntime() && fileHandle instanceof ElectronFileHandle) {
    return window.sptElectron!.invoke("fs:readText", { path: fileHandle.path });
  }
  const file = await fileHandle.getFile();
  return file.text();
};

export const writeFile = async (fileHandle: FileSystemFileHandle | ElectronFileHandle, content: string): Promise<void> => {
  if (isElectronRuntime() && fileHandle instanceof ElectronFileHandle) {
    await window.sptElectron!.invoke("fs:writeText", { path: fileHandle.path, content });
    return;
  }
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
};

export const exists = async (parentHandle: FileSystemDirectoryHandle | ElectronDirectoryHandle, name: string, kind: "file" | "directory" = "file"): Promise<boolean> => {
  try {
    if (kind === "directory") {
      await parentHandle.getDirectoryHandle(name);
    } else {
      await parentHandle.getFileHandle(name);
    }
    return true;
  } catch {
    return false;
  }
};

export const getSubdirectory = async (parent: FileSystemDirectoryHandle | ElectronDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle | ElectronDirectoryHandle> => {
  return parent.getDirectoryHandle(name);
};

export const getFileHandle = async (parent: FileSystemDirectoryHandle | ElectronDirectoryHandle, name: string): Promise<FileSystemFileHandle | ElectronFileHandle> => {
  return parent.getFileHandle(name);
};

// Category storage
export const writeCategoryFile = async (content: string) => {
  if (isElectronRuntime()) {
    await window.sptElectron!.invoke("store:write", { key: "spt_categories", content });
    return;
  }
  localStorage.setItem("spt_categories", content);
};

export const readCategoryFile = async (): Promise<string | null> => {
  if (isElectronRuntime()) {
    return window.sptElectron!.invoke("store:read", { key: "spt_categories" });
  }
  return localStorage.getItem("spt_categories");
};

// History
export const writeHistoryBackup = async (modName: string, configFile: string, timestamp: number, content: string) => {
  if (isElectronRuntime()) {
    await window.sptElectron!.invoke("history:write", { modName, configFile, timestamp, content });
    return;
  }
  const key = `spt_history_${modName}`;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.push({ configFile, timestamp, content, filename: `${configFile}_${timestamp}.json` });
  localStorage.setItem(key, JSON.stringify(existing));
};

export const readHistoryBackups = async (modName: string, configFile: string) => {
  if (isElectronRuntime()) {
    return window.sptElectron!.invoke("history:read", { modName, configFile });
  }
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  return all
    .filter((b: any) => b.configFile === configFile)
    .sort((a: any, b: any) => b.timestamp - a.timestamp);
};

export const deleteHistoryBackup = async (modName: string, filename: string) => {
  if (isElectronRuntime()) {
    await window.sptElectron!.invoke("history:delete", { modName, filename });
    return;
  }
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify(all.filter((b: any) => b.filename !== filename)));
};

export const clearHistoryBackups = async (modName: string, configFile: string) => {
  if (isElectronRuntime()) {
    await window.sptElectron!.invoke("history:clear", { modName, configFile });
    return;
  }
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify(all.filter((b: any) => b.configFile !== configFile)));
};

export const saveFile = async (blob: Blob, suggestedName: string = "file") => {
  if (isElectronRuntime()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return window.sptElectron!.invoke("file:save", {
      suggestedName,
      data: Array.from(bytes),
    });
  }

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description: "ZIP Files", accept: { "application/zip": [".zip"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { canceled: false };
  } catch (err: any) {
    if (err.name === "AbortError") return { canceled: true };
    throw err;
  }
};

/**
 * Opens a URL in the user's default browser.
 * In Electron routes through shell.openExternal so it never spawns a new
 * Electron window. Falls back to window.open in web/dev mode.
 */
export const openExternal = async (url: string): Promise<void> => {
  if (isElectronRuntime()) {
    await window.sptElectron!.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};
