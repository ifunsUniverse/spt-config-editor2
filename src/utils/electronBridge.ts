import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Electron-only app - API is always available
export const electronAPI = () => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available - this app must run in Electron');
  }
  return window.electronAPI;
};

// Category file helpers
export async function readCategoryFile(): Promise<string | null> {
  try {
    const api = electronAPI();
    const userDataPath = await api.getDocumentsPath();
    const categoryPath = `${userDataPath}/SPTModConfigEditor/UserData/categories.json`;
    const exists = await api.exists(categoryPath);
    if (!exists) return null;
    return await api.readFile(categoryPath);
  } catch (error) {
    console.error('Failed to read category file:', error);
    return null;
  }
}

export async function writeCategoryFile(content: string): Promise<void> {
  try {
    const api = electronAPI();
    const userDataPath = await api.getDocumentsPath();
    const categoryPath = `${userDataPath}/SPTModConfigEditor/UserData/categories.json`;
    await api.writeFile(categoryPath, content);
  } catch (error) {
    console.error('Failed to write category file:', error);
    throw error;
  }
}
