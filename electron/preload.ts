import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  saveData: (data: any) => Promise<void>;
  loadData: () => Promise<any>;
  exportProject: (format: 'json') => Promise<string>;
  importProject: () => Promise<any>;
  openExternal: (url: string) => void;
}

export const electronAPI: ElectronAPI = {
  saveData: (data: any) => ipcRenderer.invoke('saveData', data),
  loadData: () => ipcRenderer.invoke('loadData'),
  exportProject: (format: 'json') => ipcRenderer.invoke('exportProject', format),
  importProject: () => ipcRenderer.invoke('importProject'),
  openExternal: (url: string) => ipcRenderer.send('openExternal', url),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
