/**
 * Web-native file system bridge using the File System Access API.
 * Replaces the former Electron IPC bridge.
 */

let rootDirHandle: FileSystemDirectoryHandle | null = null;
let rootPath: string = "";

export const setRootHandle = (handle: FileSystemDirectoryHandle, path: string) => {
  rootDirHandle = handle;
  rootPath = path;
};

export const getRootHandle = () => rootDirHandle;
export const getRootPath = () => rootPath;

export const selectFolder = async (): Promise<{ canceled: boolean; path?: string; handle?: FileSystemDirectoryHandle }> => {
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

/**
 * Resolve a subdirectory handle from a path relative to a parent handle.
 */
async function resolveDir(
  base: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemDirectoryHandle> {
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
  base: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<FileSystemFileHandle> {
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

export const readdir = async (dirHandle: FileSystemDirectoryHandle): Promise<DirEntry[]> => {
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

export const readFile = async (fileHandle: FileSystemFileHandle): Promise<string> => {
  const file = await fileHandle.getFile();
  return await file.text();
};

export const writeFile = async (fileHandle: FileSystemFileHandle, content: string): Promise<void> => {
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
};

export const exists = async (parentHandle: FileSystemDirectoryHandle, name: string, kind: "file" | "directory" = "file"): Promise<boolean> => {
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

export const getSubdirectory = async (parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> => {
  return parent.getDirectoryHandle(name);
};

export const getFileHandle = async (parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle> => {
  return parent.getFileHandle(name);
};

// Category storage — uses localStorage in web mode
export const writeCategoryFile = async (content: string) => {
  localStorage.setItem("spt_categories", content);
};

export const readCategoryFile = async (): Promise<string | null> => {
  return localStorage.getItem("spt_categories");
};

// History — uses localStorage in web mode  
export const writeHistoryBackup = async (modName: string, configFile: string, timestamp: number, content: string) => {
  const key = `spt_history_${modName}`;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.push({ configFile, timestamp, content, filename: `${configFile}_${timestamp}.json` });
  localStorage.setItem(key, JSON.stringify(existing));
};

export const readHistoryBackups = async (modName: string, configFile: string) => {
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  return all
    .filter((b: any) => b.configFile === configFile)
    .sort((a: any, b: any) => b.timestamp - a.timestamp);
};

export const deleteHistoryBackup = async (modName: string, filename: string) => {
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify(all.filter((b: any) => b.filename !== filename)));
};

export const clearHistoryBackups = async (modName: string, configFile: string) => {
  const key = `spt_history_${modName}`;
  const all = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify(all.filter((b: any) => b.configFile !== configFile)));
};

export const saveFile = async (blob: Blob, suggestedName: string = "file") => {
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
