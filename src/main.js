const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let isMiniMode = false;

const STORE_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveSettings(data) {
  try {
    const existing = loadSettings();
    fs.writeFileSync(STORE_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
  } catch (e) {}
}

const FULL_WIDTH = 280;
const FULL_HEIGHT = 350;
const MINI_WIDTH = 120;
const MINI_HEIGHT = 50;

function createWindow() {
  const settings = loadSettings();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const defaultX = sw - FULL_WIDTH - 24;
  const defaultY = sh - FULL_HEIGHT - 24;

  mainWindow = new BrowserWindow({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    x: settings.x ?? defaultX,
    y: settings.y ?? defaultY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    saveSettings({ x, y });
  });

  // Save position periodically
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      saveSettings({ x, y });
    }
  }, 3000);
}

function createTray() {
  // Create a simple pink square tray icon programmatically
  const { nativeImage } = require('electron');
  const icon = nativeImage.createEmpty();
  
  try {
    const iconPath = path.join(__dirname, 'icon.ico');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
    } else {
      // fallback: use a 16x16 png buffer (pink pixel)
      const { createCanvas } = (() => { try { return require('canvas'); } catch(e) { return null; } })() || {};
      tray = new Tray(nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYGD4z8BAAiNJgAWoYABVDKMGUA2jBlANowZQDaMGUA2jBlANowZQDQDkAAQAAkgBJQAAAABJRU5ErkJggg=='
      ));
    }
  } catch(e) {
    tray = new Tray(nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYGD4z8BAAiNJgAWoYABVDKMGUA2jBlANowZQDaMGUA2jBlANowZQDQDkAAQAAkgBJQAAAABJRU5ErkJggg=='
    ));
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Hezz Timer 🍅');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC handlers
ipcMain.on('set-mini-mode', (event, mini) => {
  isMiniMode = mini;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;

  if (mini) {
    const [cx, cy] = mainWindow.getPosition();
    mainWindow.setSize(MINI_WIDTH, MINI_HEIGHT);
    // Snap to right edge
    mainWindow.setPosition(sw - MINI_WIDTH, cy);
  } else {
    mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
    const [cx, cy] = mainWindow.getPosition();
    // Keep on screen
    const nx = Math.min(cx, sw - FULL_WIDTH);
    const ny = Math.min(cy, sh - FULL_HEIGHT);
    mainWindow.setPosition(Math.max(0, nx), Math.max(0, ny));
  }
});

ipcMain.on('save-settings', (event, data) => {
  saveSettings(data);
});

ipcMain.handle('load-settings', () => {
  return loadSettings();
});

ipcMain.on('drag-move', (event, { dx, dy }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;
    const [w, h] = mainWindow.getSize();
    const nx = Math.max(0, Math.min(x + dx, sw - w));
    const ny = Math.max(0, Math.min(y + dy, sh - h));
    mainWindow.setPosition(nx, ny);
  }
});

function enableAutoStart() {
  try {
    if (!app.isPackaged) return;
    const { shell } = require('electron');
    const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const lnkPath = path.join(startupFolder, 'Hezz Timer.lnk');
    shell.writeShortcutLink(lnkPath, 'create', {
      target: app.getPath('exe'),
      cwd: path.dirname(app.getPath('exe')),
      description: 'Hezz Timer 🍅'
    });
  } catch (e) {}
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  enableAutoStart();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
