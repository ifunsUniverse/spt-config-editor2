import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hasBridge = !!(window as any).electronAPI;
  const ua = navigator?.userAgent?.toLowerCase?.() || '';
  const isUA = ua.includes('electron');
  return hasBridge || isUA;
};

export const electronAPI = () => {
  if (!isElectron()) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI!;
};
