import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { saveData, loadData, exportProject, importProject } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: Electron.BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'Clue Wall',
    backgroundColor: '#1a1a2e',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('saveData', async (_event: Electron.IpcMainInvokeEvent, data: any) => {
  saveData(data);
});

ipcMain.handle('loadData', async () => {
  return loadData();
});

ipcMain.handle('exportProject', async (_event: Electron.IpcMainInvokeEvent, format: 'json') => {
  const data = exportProject();

  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出项目',
    defaultPath: `clue-wall-project-${Date.now()}.${format}`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return result.filePath;
  }

  return '';
});

ipcMain.handle('importProject', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '导入项目',
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    return importProject(content);
  }

  return null;
});

ipcMain.on('openExternal', (_event: Electron.IpcMainEvent, url: string) => {
  shell.openExternal(url);
});
