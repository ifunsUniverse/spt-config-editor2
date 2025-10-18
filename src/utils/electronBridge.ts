import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI;
};

export const electronAPI = () => {
  if (!isElectron()) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI!;
};
