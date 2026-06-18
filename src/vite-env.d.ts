/// <reference types="vite/client" />

export interface ElectronAPI {
  saveData: (data: any) => Promise<void>;
  loadData: () => Promise<any>;
  exportProject: (format: 'json') => Promise<string>;
  importProject: () => Promise<any>;
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

