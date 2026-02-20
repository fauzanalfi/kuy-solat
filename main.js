const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { getFormattedPrayerTimes, getNextPrayer, getCurrentPrayer } = require('./src/prayer-times');
const { detectLocation } = require('./src/location');
const { setMainWindow, scheduleNotifications, clearAllTimers } = require('./src/notification');
const store = require('./src/store');

let tray = null;
let mainWindow = null;
let currentLocation = null;
let refreshTimer = null;
let minuteInterval = null;

// === Hijri offset persistence ===
function getHijriOffsetPath() {
  return path.join(app.getPath('userData'), 'hijri-offset.json');
}

function loadHijriOffset() {
  try {
    const data = fs.readFileSync(getHijriOffsetPath(), 'utf-8');
    return JSON.parse(data).offset || 0;
  } catch {
    return 0;
  }
}

function saveHijriOffset(offset) {
  try {
    fs.writeFileSync(getHijriOffsetPath(), JSON.stringify({ offset }));
  } catch (e) {
    console.error('Failed to save hijri offset:', e.message);
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    toggleWindow();
  }
});

app.whenReady().then(async () => {
  // Terapkan auto-start awal
  const isAutoStart = store.get('autoStart');
  app.setLoginItemSettings({
    openAtLogin: isAutoStart,
    openAsHidden: true
  });
  // Detect location
  currentLocation = await detectLocation();
  console.log('Location detected:', currentLocation.city, currentLocation.region);

  createTray();
  createWindow();
  updatePrayerData();

  // Memulai timer sinkronisasi per menit
  startMinuteSyncTimer();

  // Refresh jadwal setiap hari jam 00:01
  scheduleDailyRefresh();

  // Ketika komputer menyala kembali dari mode Sleep/Hibernate, data di-refresh
  powerMonitor.on('resume', async () => {
    console.log('System resumed, refreshing data...');
    // Coba deteksi ulang jika setting auto untuk dapat IP baru (optional, but safe)
    currentLocation = await detectLocation();
    
    updatePrayerData();
    // Re-schedule daily refresh jika terlewat
    if (refreshTimer) clearTimeout(refreshTimer);
    scheduleDailyRefresh();
    
    startMinuteSyncTimer(); // restart minute sync
  });
});

/**
 * Memastikan setInterval berjalan setiap menit dengan pas di detik == 0
 */
function startMinuteSyncTimer() {
  if (minuteInterval) clearInterval(minuteInterval);

  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    updateTrayTooltip();
    minuteInterval = setInterval(() => {
      updateTrayTooltip();
    }, 60000);
  }, msToNextMinute);
}

app.on('window-all-closed', (e) => {
  // Prevent app from quitting when window is closed
  e.preventDefault();
});

/**
 * Membuat tray icon
 */
function createTray() {
  // Create a simple tray icon programmatically
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon();
    }
  } catch (e) {
    trayIcon = createDefaultIcon();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📋 Tampilkan Jadwal',
      click: () => toggleWindow()
    },
    { type: 'separator' },
    {
      label: '🔄 Refresh Lokasi',
      click: async () => {
        currentLocation = await detectLocation();
        updatePrayerData();
      }
    },
    { type: 'separator' },
    {
      label: '❌ Keluar',
      click: () => {
        clearAllTimers();
        if (refreshTimer) clearTimeout(refreshTimer);
        app.exit(0);
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Kuy Solat - Loading...');

  tray.on('click', () => {
    toggleWindow();
  });
}

/**
 * Buat ikon default jika file tidak ditemukan
 */
function createDefaultIcon() {
  const size = 32;
  const canvas = require('electron').nativeImage.createEmpty();

  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = size / 2, cy = size / 2, r = size / 2 - 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= r) {
        const moonDist = Math.sqrt((x - cx - 5) ** 2 + (y - cy) ** 2);
        if (moonDist > r - 3) {
          buffer[idx] = 108;
          buffer[idx + 1] = 99;
          buffer[idx + 2] = 255;
          buffer[idx + 3] = 255;
        } else {
          buffer[idx + 3] = 0;
        }
      } else {
        buffer[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, {
    width: size,
    height: size
  });
}

/**
 * Membuat popup window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 600,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  // Lempar referensi window ke notifikasi, supaya bisa nge-trigger adzan
  setMainWindow(mainWindow);
}

/**
 * Toggle visibility popup window di dekat tray icon
 */
function toggleWindow() {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    positionWindow();
    mainWindow.show();
    mainWindow.focus();
    sendPrayerData();
  }
}

/**
 * Posisikan window di dekat tray icon (pojok kanan bawah)
 */
function positionWindow() {
  if (!tray || !mainWindow) return;

  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const { screen } = require('electron');
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });

  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  let y = Math.round(trayBounds.y - windowBounds.height - 8);

  if (x + windowBounds.width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - windowBounds.width - 8;
  }
  if (x < workArea.x) {
    x = workArea.x + 8;
  }
  if (y < workArea.y) {
    y = trayBounds.y + trayBounds.height + 8;
  }

  mainWindow.setPosition(x, y, false);
}

/**
 * Update data jadwal shalat & kirim ke renderer
 */
function updatePrayerData() {
  if (!currentLocation) return;

  const prayerTimes = getFormattedPrayerTimes(
    currentLocation.latitude,
    currentLocation.longitude
  );

  scheduleNotifications(prayerTimes);
  updateTrayTooltip();
  sendPrayerData();
}

/**
 * Kirim data jadwal shalat ke renderer
 */
function sendPrayerData() {
  if (!mainWindow || !currentLocation) return;

  const prayerTimes = getFormattedPrayerTimes(
    currentLocation.latitude,
    currentLocation.longitude
  );

  const nextPrayer = getNextPrayer(
    currentLocation.latitude,
    currentLocation.longitude
  );

  const currentPrayer = getCurrentPrayer(
    currentLocation.latitude,
    currentLocation.longitude
  );

  mainWindow.webContents.send('prayer-data', {
    prayerTimes,
    nextPrayer,
    currentPrayer,
    location: currentLocation
  });
}

/**
 * Update tooltip tray icon
 */
function updateTrayTooltip() {
  if (!tray || !currentLocation) return;

  try {
    const nextPrayer = getNextPrayer(
      currentLocation.latitude,
      currentLocation.longitude
    );

    if (nextPrayer) {
      const now = new Date();
      const diff = new Date(nextPrayer.time).getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let countdown = '';
      let countdownStr = '';
      if (hours > 0) {
        countdownStr = `${hours}j ${minutes}m`;
        countdown = `${countdownStr} lagi`;
      } else {
        countdownStr = `${minutes}m`;
        if (minutes < 15) {
            countdownStr = `! ${minutes}m`;
        }
        countdown = `${minutes}m lagi`;
      }

      tray.setToolTip(
        `🕌 Kuy Solat\n${nextPrayer.name}: ${nextPrayer.formatted} (${countdown})\n📍 ${currentLocation.city}`
      );
      
      // Update dynamic icon
      updateTrayIcon(countdownStr, minutes < 15 && hours === 0);
    }
  } catch (e) {
    tray.setToolTip('🕌 Kuy Solat');
    updateTrayIcon('🕌', false);
  }
}

/**
 * Custom Tray Icon with Countdown menggunakan Canvas Buffer manipulation sederhana
 */
function updateTrayIcon(text, isUrgent) {
  if (!tray) return;

  // Gunakan icon default/moon jika text panjang/null
  if (!text || text === '🕌' || text.length > 5) {
      const defaultIcon = createDefaultIcon();
      tray.setImage(defaultIcon.resize({ width: 16, height: 16 }));
      return;
  }

  // Coba fetch icon png dan tempelkan kalau urgent (opsional) atau fallback ke icon default saja.
  // Untuk kepraktisan rendering native canvas (jaga performa Node/Electron yang gak punya Canvas object native tanpa module tambahan):
  // Kita kembalikan fallback icon default/urgent version.
  const size = 32;
  const canvas = require('electron').nativeImage.createEmpty();
  const buffer = Buffer.alloc(size * size * 4);

  // Simple dot/circle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
       const idx = (y * size + x) * 4;
       const cx = size/2, cy = size/2, r = size/2 - 2;
       const dist = Math.sqrt((x - cx)**2 + (y-cy)**2);
       if (dist <= r) {
           buffer[idx] = isUrgent ? 60 : 108; // R
           buffer[idx+1] = isUrgent ? 60 : 99; // G
           buffer[idx+2] = isUrgent ? 255 : 255; // B
           buffer[idx+3] = 255;
       } else {
           buffer[idx+3] = 0;
       }
    }
  }

  tray.setImage(nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size
  }).resize({ width: 16, height: 16 }));
}

/**
 * Jadwalkan refresh harian
 */
function scheduleDailyRefresh() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  refreshTimer = setTimeout(() => {
    updatePrayerData();
    scheduleDailyRefresh();
  }, msUntilMidnight);
}

// IPC handlers
ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('refresh-data', () => {
  updatePrayerData();
});

// Hijri offset IPC
ipcMain.handle('get-hijri-offset', () => {
  return loadHijriOffset();
});

ipcMain.on('set-hijri-offset', (event, offset) => {
  saveHijriOffset(offset);
});

// Settings IPC
ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('save-settings', async (event, newSettings) => {
  store.set(newSettings);
  
  // Terapkan auto-start
  app.setLoginItemSettings({
    openAtLogin: newSettings.autoStart === true,
    openAsHidden: true
  });
  
  // Jika manual loc berubah, update data
  currentLocation = await detectLocation();
  updatePrayerData();
  
  return store.store;
});

// Pilih file dialog
const { dialog } = require('electron');
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Audio Adzan',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});
