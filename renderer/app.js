const { ipcRenderer } = require('electron');

let countdownInterval = null;
let currentData = null;
let hijriOffset = 0; // Koreksi tanggal Hijriyah (dalam hari)
let currentSettings = null; // Menyimpan settings lokal di frontend

// DOM Elements Settings Modal
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const adzanPlayer = document.getElementById('adzanPlayer');

// Setup form element references
const fAutostart = document.getElementById('setAutostart');
const fAudioEnabled = document.getElementById('setAudioEnabled');
const fAudioFile = document.getElementById('setAudioFile');
const browseAudioBtn = document.getElementById('browseAudioBtn');
const fManualLocMode = document.getElementById('setManualLocMode');
const manualLocGroup = document.getElementById('manualLocGroup');
const fManualCity = document.getElementById('setManualCity');
const fTheme = document.getElementById('setTheme'); // Theme combo
const cbMutes = {
  subuh: document.getElementById('muteSubuh'),
  terbit: document.getElementById('muteTerbit'),
  dzuhur: document.getElementById('muteDzuhur'),
  ashar: document.getElementById('muteAshar'),
  maghrib: document.getElementById('muteMaghrib'),
  isya: document.getElementById('muteIsya')
};

// Muat offset dari main process
ipcRenderer.invoke('get-hijri-offset').then(offset => {
  hijriOffset = offset || 0;
  updateDateDisplay();
});

// Load settings saat app load
ipcRenderer.invoke('get-settings').then(settings => {
  currentSettings = settings;
  applyTheme(settings.theme || 'default');
  populateSettingsForm(settings);
});

// Terima data dari main process
ipcRenderer.on('prayer-data', (event, data) => {
  currentData = data;
  renderPrayerTimes(data);
  startCountdown(data);
  updateDateDisplay(data);
  updateLocation(data);
});

// Mainkan Adzan
ipcRenderer.on('play-adzan', (event, payload) => {
  try {
    // Handling argumen baru (object) vs lama (string fallback)
    let audioFilePath = 'default';
    let prayerName = null;

    if (typeof payload === 'string') {
      audioFilePath = payload;
    } else if (payload && typeof payload === 'object') {
      audioFilePath = payload.file;
      prayerName = payload.prayerName; // e.g 'subuh', 'dzuhur'
    }

    // Cek apakah waktu shalat ini di-mute?
    if (prayerName && currentSettings?.audio?.muted) {
      if (currentSettings.audio.muted[prayerName] === true) {
        console.log(`Adzan untuk ${prayerName} dibisukan (muted) oleh pengguna.`);
        return; // Jangan play
      }
    }

    if (audioFilePath && audioFilePath !== 'default') {
      adzanPlayer.src = audioFilePath;
    } else {
      // Gunakan default path dari dir assets main/app app.getAppPath() 
      // Karena kita di renderer local, kita bisa tembak relative jika disajikan path native.
      // Sederhananya, file default ada di /assets/adzan.mp3
      adzanPlayer.src = '../assets/adzan.mp3'; 
    }
    
    // Play with small delay or direct
    adzanPlayer.currentTime = 0;
    adzanPlayer.play().catch(e => {
       console.error("Audio play failed:", e);
    });
  } catch(e) {
    console.warn("Could not play adzan", e);
  }
});

// ======== Handlers Modal ========

settingsBtn.addEventListener('click', () => {
  if (currentSettings) {
     populateSettingsForm(currentSettings);
  }
  settingsModal.classList.add('show');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

// Toggle Mode Lokasi di form
fManualLocMode.addEventListener('change', (e) => {
  manualLocGroup.style.display = e.target.checked ? 'block' : 'none';
});

// Tombol Browse file khusus via ipcRenderer showOpenDialog
const testAudioBtn = document.getElementById('testAudioBtn');

browseAudioBtn.addEventListener('click', async () => {
  const filePath = await ipcRenderer.invoke('dialog:openFile');
  if (filePath) {
      fAudioFile.value = filePath;
  }
});

// Test memutar audio yang ada di kotak input 
testAudioBtn.addEventListener('click', () => {
  let tempAudioPath = fAudioFile.value;
  if (!tempAudioPath || tempAudioPath === 'default') {
      tempAudioPath = '../assets/adzan.mp3';
  }
  
  if (adzanPlayer.paused) {
      adzanPlayer.src = tempAudioPath;
      adzanPlayer.currentTime = 0;
      adzanPlayer.play().catch(e => console.error("Test Play failed", e));
      testAudioBtn.textContent = 'Stop Suara';
  } else {
      adzanPlayer.pause();
      adzanPlayer.currentTime = 0;
      testAudioBtn.textContent = 'Test Suara';
  }
});

// Kembalikan tulisan tombol saat audio selesai main
adzanPlayer.addEventListener('ended', () => {
  testAudioBtn.textContent = 'Test Suara';
});

// Handler saat Theme diganti secara live preview
fTheme.addEventListener('change', (e) => {
  applyTheme(e.target.value);
});

// Simpan Setting
saveSettingsBtn.addEventListener('click', async () => {
  const newSettings = {
    ...currentSettings,
    autoStart: fAutostart.checked,
    theme: fTheme.value || 'default',
    audio: {
      enabled: fAudioEnabled.checked,
      file: fAudioFile.value || 'default',
      muted: {
        subuh: cbMutes.subuh.checked,
        terbit: cbMutes.terbit.checked,
        dzuhur: cbMutes.dzuhur.checked,
        ashar: cbMutes.ashar.checked,
        maghrib: cbMutes.maghrib.checked,
        isya: cbMutes.isya.checked
      }
    },
    location: {
      type: fManualLocMode.checked ? 'manual' : 'auto',
      manualCity: fManualCity.value || currentSettings.location?.manualCity || 'Jakarta',
      manualCoordinates: currentSettings.location?.manualCoordinates || {}
    }
  };

  saveSettingsBtn.textContent = 'Menyimpan...';
  
  // Kirim untuk disimpan dan terapkan efaknya
  const updated = await ipcRenderer.invoke('save-settings', newSettings);
  currentSettings = updated;
  
  saveSettingsBtn.textContent = 'Simpan & Terapkan';
  settingsModal.classList.remove('show');
});

function applyTheme(themeName) {
  // Clear semua theme class di body
  document.body.classList.remove('theme-hijau', 'theme-putih', 'theme-hitam');
  if (themeName && themeName !== 'default') {
    document.body.classList.add('theme-' + themeName);
  }
}

function populateSettingsForm(settings) {
  if (!settings) return;
  fAutostart.checked = settings.autoStart === true;
  fTheme.value = settings.theme || 'default';
  fAudioEnabled.checked = settings.audio?.enabled === true;
  fAudioFile.value = settings.audio?.file === 'default' ? '' : settings.audio?.file;
  
  if (settings.audio?.muted) {
    cbMutes.subuh.checked = settings.audio.muted.subuh === true;
    cbMutes.terbit.checked = settings.audio.muted.terbit === true;
    cbMutes.dzuhur.checked = settings.audio.muted.dzuhur === true;
    cbMutes.ashar.checked = settings.audio.muted.ashar === true;
    cbMutes.maghrib.checked = settings.audio.muted.maghrib === true;
    cbMutes.isya.checked = settings.audio.muted.isya === true;
  }
  
  if (settings.location?.type === 'manual') {
      fManualLocMode.checked = true;
      manualLocGroup.style.display = 'block';
  } else {
      fManualLocMode.checked = false;
      manualLocGroup.style.display = 'none';
  }
  
  fManualCity.value = settings.location?.manualCity || '';
}

// ======== Handlers Header/Base ========

// Tombol close utama
document.getElementById('closeBtn').addEventListener('click', () => {
  ipcRenderer.send('hide-window');
});

// Tombol koreksi Hijriyah
document.getElementById('hijriMinus').addEventListener('click', () => {
  hijriOffset--;
  ipcRenderer.send('set-hijri-offset', hijriOffset);
  updateDateDisplay();
});

document.getElementById('hijriPlus').addEventListener('click', () => {
  hijriOffset++;
  ipcRenderer.send('set-hijri-offset', hijriOffset);
  updateDateDisplay();
});

/**
 * Render jadwal shalat ke DOM
 */
function renderPrayerTimes(data) {
  const { prayerTimes, currentPrayer, nextPrayer } = data;

  // Set waktu
  document.getElementById('timeSubuh').textContent = prayerTimes.subuh;
  document.getElementById('timeTerbit').textContent = prayerTimes.terbit;
  document.getElementById('timeDzuhur').textContent = prayerTimes.dzuhur;
  document.getElementById('timeAshar').textContent = prayerTimes.ashar;
  document.getElementById('timeMaghrib').textContent = prayerTimes.maghrib;
  document.getElementById('timeIsya').textContent = prayerTimes.isya;

  // Highlight aktif & yang sudah lewat
  const prayerOrder = ['subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  const prayerNameMap = {
    'Subuh': 'subuh',
    'Terbit': 'terbit',
    'Dzuhur': 'dzuhur',
    'Ashar': 'ashar',
    'Maghrib': 'maghrib',
    'Isya': 'isya'
  };

  const currentKey = currentPrayer ? prayerNameMap[currentPrayer] : null;
  const nextKey = nextPrayer ? prayerNameMap[nextPrayer.name] : null;

  let passedCurrent = false;

  prayerOrder.forEach(key => {
    const item = document.querySelector(`[data-prayer="${key}"]`);
    if (!item) return;

    item.classList.remove('active', 'passed');

    if (key === currentKey) {
      item.classList.add('active');
      passedCurrent = true;
    } else if (key === nextKey) {
      passedCurrent = true;
    } else if (!passedCurrent && currentKey) {
      item.classList.add('passed');
    } else if (!currentKey && nextKey) {
      const nextIdx = prayerOrder.indexOf(nextKey);
      const thisIdx = prayerOrder.indexOf(key);
      if (thisIdx < nextIdx) {
        item.classList.add('passed');
      }
    }
  });

  // Set next prayer name
  if (nextPrayer) {
    document.getElementById('nextPrayerName').textContent = nextPrayer.name;
  }
}

/**
 * Start countdown timer ke waktu shalat berikutnya
 */
function startCountdown(data) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const { nextPrayer } = data;
  if (!nextPrayer || !nextPrayer.time) return;

  const targetTime = new Date(nextPrayer.time);

  function updateCountdown() {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();

    if (diff <= 0) {
      document.getElementById('countdown').textContent = '00:00:00';
      ipcRenderer.send('refresh-data');
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('countdown').textContent =
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Update tampilan tanggal (Masehi + Hijriyah dengan koreksi)
 */
function updateDateDisplay() {
  const now = new Date();

  // Tanggal Masehi
  const masehiOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  document.getElementById('masehiDate').textContent =
    now.toLocaleDateString('id-ID', masehiOptions);

  // Tanggal Hijriyah dengan koreksi offset
  try {
    const correctedDate = new Date(now);
    correctedDate.setDate(correctedDate.getDate() + hijriOffset);

    const hijriFormatter = new Intl.DateTimeFormat('id-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let hijriText = hijriFormatter.format(correctedDate);
    if (hijriOffset !== 0) {
      const sign = hijriOffset > 0 ? '+' : '';
      hijriText += ` (${sign}${hijriOffset})`;
    }
    document.getElementById('hijriDate').textContent = hijriText;
  } catch (e) {
    document.getElementById('hijriDate').textContent = 'Hijriyah';
  }
}

/**
 * Update lokasi display
 */
function updateLocation(data) {
  if (data.location) {
    const { city, region } = data.location;
    document.getElementById('cityName').textContent =
      city ? `${city}, ${region}` : region || 'Indonesia';
  }
}

// init date display segera
updateDateDisplay();
