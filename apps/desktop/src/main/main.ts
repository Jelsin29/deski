import { app, BrowserWindow, session } from 'electron';
import { fileURLToPath } from 'node:url';

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  await window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
}

function failStartup(error: unknown): void {
  console.error('Unable to open the Deski scaffold:', error);
  app.exit(1);
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch(failStartup);
    }
  });
}).catch(failStartup);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
