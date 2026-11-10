import { app, BrowserWindow, nativeTheme, session } from 'electron';
import { fileURLToPath } from 'node:url';
import type { BackendMode } from '../shared/deski-api.js';
import { createBackendClient } from './backend-client.ts';
import { createFakeBackendClient } from './fake-backend.ts';
import { registerIpcHandlers } from './ipc.ts';

const resolve = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const RENDERER_PATH = resolve('../renderer/index.html');
const PRELOAD_PATH = resolve('../preload/index.cjs');
const ICON_PATH = resolve('../../assets/icon.png');

// `npm run dev:fake` passes --fake-api to answer with the development stand-in.
const BACKEND_MODE: BackendMode = process.argv.includes('--fake-api') ? 'fake' : 'live';

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: 'Deski',
    icon: ICON_PATH,
    show: false,
    // Matches the theme background so no white flash appears before paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17171a' : '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: PRELOAD_PATH,
      additionalArguments: [`--deski-backend-mode=${BACKEND_MODE}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  await window.loadFile(RENDERER_PATH);
}

function failStartup(error: unknown): void {
  console.error('Unable to open Deski:', error);
  app.exit(1);
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerIpcHandlers(
    BACKEND_MODE === 'fake'
      ? createFakeBackendClient()
      : createBackendClient(process.env.DESKI_BACKEND_URL),
  );
  app.dock?.setIcon(ICON_PATH);
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
