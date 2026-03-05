/**
 * Browser-compatible bridge utility.
 * Replaces Electron IPC with browser APIs (File System Access API, localStorage, etc.)
 */

export const selectFolder = async (): Promise<{ canceled: boolean; path?: string; handle?: FileSystemDirectoryHandle }> => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Your browser doesn't support folder selection. Please use Chrome or Edge.");
  }
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    return { canceled: false, path: handle.name, handle };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { canceled: true };
    }
    throw err;
  }
};

// Store the directory handle globally so other utils can access it
let _rootHandle: FileSystemDirectoryHandle | null = null;

export const setRootHandle = (handle: FileSystemDirectoryHandle) => {
  _rootHandle = handle;
};

export const getRootHandle = (): FileSystemDirectoryHandle | null => _rootHandle;

export const readdir = async (dirHandle: FileSystemDirectoryHandle): Promise<{ name: string; isFile: boolean; isDirectory: boolean; handle: FileSystemHandle }[]> => {
  const entries: { name: string; isFile: boolean; isDirectory: boolean; handle: FileSystemHandle }[] = [];
  for await (const [name, handle] of (dirHandle as any).entries()) {
    entries.push({
      name,
      isFile: handle.kind === 'file',
      isDirectory: handle.kind === 'directory',
      handle,
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

export const exists = async (dirHandle: FileSystemDirectoryHandle, name: string): Promise<FileSystemHandle | null> => {
  try {
    try {
      return await dirHandle.getDirectoryHandle(name);
    } catch {
      return await dirHandle.getFileHandle(name);
    }
  } catch {
    return null;
  }
};

// Category storage - use localStorage
export const writeCategoryFile = async (content: string) => {
  localStorage.setItem("spt-categories", content);
};

export const readCategoryFile = async (): Promise<string | null> => {
  return localStorage.getItem("spt-categories");
};

// History storage - use localStorage
export const writeHistoryBackup = async (modName: string, configFile: string, timestamp: number, content: string) => {
  const key = `spt-history:${modName}:${configFile}`;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.unshift({ timestamp, content, filename: `${timestamp}.json` });
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 10)));
};

export const readHistoryBackups = async (modName: string, configFile: string): Promise<{ timestamp: number; content: string; filename: string }[]> => {
  const key = `spt-history:${modName}:${configFile}`;
  return JSON.parse(localStorage.getItem(key) || "[]");
};

export const deleteHistoryBackup = async (modName: string, filename: string) => {
  // Find and remove from all history keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`spt-history:${modName}:`)) {
      const entries = JSON.parse(localStorage.getItem(key) || "[]");
      const filtered = entries.filter((e: any) => e.filename !== filename);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  }
};

export const clearHistoryBackups = async (modName: string, configFile: string) => {
  const key = `spt-history:${modName}:${configFile}`;
  localStorage.removeItem(key);
};

export const saveFile = async (options: { defaultPath?: string; filters?: any[] }): Promise<{ canceled: boolean; filePath?: string; handle?: FileSystemFileHandle }> => {
  if (!('showSaveFilePicker' in window)) {
    throw new Error("Your browser doesn't support save dialog. Please use Chrome or Edge.");
  }
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: options.defaultPath || 'file.json',
      types: options.filters?.map((f: any) => ({
        description: f.name,
        accept: { 'application/octet-stream': f.extensions.map((e: string) => `.${e}`) }
      })) || []
    });
    return { canceled: false, filePath: handle.name, handle };
  } catch (err: any) {
    if (err.name === 'AbortError') return { canceled: true };
    throw err;
  }
};
