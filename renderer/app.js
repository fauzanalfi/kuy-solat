const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { convertFileSrc } = window.__TAURI__.core;

let countdownInterval = null;
let currentData = null;
let hijriOffset = 0;
let currentSettings = null;

const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const adzanPlayer = document.getElementById('adzanPlayer');

const fAutostart = document.getElementById('setAutostart');
const fAudioEnabled = document.getElementById('setAudioEnabled');
const fAudioFile = document.getElementById('setAudioFile');
const browseAudioBtn = document.getElementById('browseAudioBtn');
const fManualLocMode = document.getElementById('setManualLocMode');
const manualLocGroup = document.getElementById('manualLocGroup');
const fManualCity = document.getElementById('setManualCity');
const fTheme = document.getElementById('setTheme');
const testAudioBtn = document.getElementById('testAudioBtn');
const cbMutes = {
  subuh: document.getElementById('muteSubuh'),
  terbit: document.getElementById('muteTerbit'),
  dzuhur: document.getElementById('muteDzuhur'),
  ashar: document.getElementById('muteAshar'),
  maghrib: document.getElementById('muteMaghrib'),
  isya: document.getElementById('muteIsya'),
};

async function init() {
  hijriOffset = (await invoke('get_hijri_offset')) || 0;
  updateDateDisplay();

  currentSettings = await invoke('get_settings');
  applyTheme(currentSettings.theme || 'default');
  populateSettingsForm(currentSettings);

  const initial = await invoke('get_prayer_data');
  currentData = initial;
  renderPrayerTimes(initial);
  startCountdown(initial);
  updateDateDisplay();
  updateLocation(initial);

  await listen('prayer-data', (event) => {
    currentData = event.payload;
    renderPrayerTimes(event.payload);
    startCountdown(event.payload);
    updateDateDisplay();
    updateLocation(event.payload);
  });

  await listen('play-adzan', (event) => {
    playAdzan(event.payload);
  });
}

function resolveAudioSrc(audioFilePath) {
  if (audioFilePath && audioFilePath !== 'default') {
    try {
      return convertFileSrc(audioFilePath);
    } catch {
      return audioFilePath;
    }
  }
  return './assets/adzan.mp3';
}

function playAdzan(payload) {
  try {
    let audioFilePath = 'default';
    let prayerName = null;

    if (typeof payload === 'string') {
      audioFilePath = payload;
    } else if (payload && typeof payload === 'object') {
      audioFilePath = payload.file;
      prayerName = payload.prayerName;
    }

    if (prayerName && currentSettings?.audio?.muted?.[prayerName] === true) {
      return;
    }

    adzanPlayer.src = resolveAudioSrc(audioFilePath);
    adzanPlayer.currentTime = 0;
    adzanPlayer.play().catch((e) => console.error('Audio play failed:', e));
  } catch (e) {
    console.warn('Could not play adzan', e);
  }
}

settingsBtn.addEventListener('click', async () => {
  if (currentSettings) populateSettingsForm(currentSettings);
  settingsModal.classList.add('show');
  await invoke('set_settings_open', { open: true });
});

closeSettingsBtn.addEventListener('click', async () => {
  settingsModal.classList.remove('show');
  await invoke('set_settings_open', { open: false });
});

fManualLocMode.addEventListener('change', (e) => {
  manualLocGroup.style.display = e.target.checked ? 'block' : 'none';
});

browseAudioBtn.addEventListener('click', async () => {
  await invoke('set_settings_open', { open: true });
  const filePath = await invoke('pick_audio_file');
  if (filePath) {
    fAudioFile.value = filePath;
  }
});

testAudioBtn.addEventListener('click', () => {
  let tempAudioPath = fAudioFile.value;
  if (!tempAudioPath || tempAudioPath === 'default') {
    tempAudioPath = 'default';
  }

  if (adzanPlayer.paused) {
    adzanPlayer.src = resolveAudioSrc(tempAudioPath);
    adzanPlayer.currentTime = 0;
    adzanPlayer.play().catch((e) => console.error('Test Play failed', e));
    testAudioBtn.textContent = 'Stop Suara';
  } else {
    adzanPlayer.pause();
    adzanPlayer.currentTime = 0;
    testAudioBtn.textContent = 'Test Suara';
  }
});

adzanPlayer.addEventListener('ended', () => {
  testAudioBtn.textContent = 'Test Suara';
});

fTheme.addEventListener('change', (e) => {
  applyTheme(e.target.value);
});

saveSettingsBtn.addEventListener('click', async () => {
  const newSettings = {
    ...currentSettings,
    autoStart: fAutostart.checked,
    theme: fTheme.value || 'default',
    hijriOffset,
    audio: {
      enabled: fAudioEnabled.checked,
      file: fAudioFile.value || 'default',
      muted: {
        subuh: cbMutes.subuh.checked,
        terbit: cbMutes.terbit.checked,
        dzuhur: cbMutes.dzuhur.checked,
        ashar: cbMutes.ashar.checked,
        maghrib: cbMutes.maghrib.checked,
        isya: cbMutes.isya.checked,
      },
    },
    location: {
      type: fManualLocMode.checked ? 'manual' : 'auto',
      manualCity: fManualCity.value || currentSettings.location?.manualCity || 'Jakarta',
      manualCoordinates: currentSettings.location?.manualCoordinates || {
        latitude: -6.2088,
        longitude: 106.8456,
      },
    },
  };

  saveSettingsBtn.textContent = 'Menyimpan...';
  try {
    const updated = await invoke('save_app_settings', { newSettings });
    currentSettings = updated;
    settingsModal.classList.remove('show');
    await invoke('set_settings_open', { open: false });
  } catch (e) {
    console.error(e);
    alert('Gagal menyimpan pengaturan: ' + e);
  } finally {
    saveSettingsBtn.textContent = 'Simpan & Terapkan';
  }
});

function applyTheme(themeName) {
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
  fAudioFile.value = settings.audio?.file === 'default' ? '' : settings.audio?.file || '';

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

document.getElementById('closeBtn').addEventListener('click', () => {
  invoke('hide_window');
});

document.getElementById('hijriMinus').addEventListener('click', async () => {
  hijriOffset--;
  await invoke('set_hijri_offset', { offset: hijriOffset });
  updateDateDisplay();
});

document.getElementById('hijriPlus').addEventListener('click', async () => {
  hijriOffset++;
  await invoke('set_hijri_offset', { offset: hijriOffset });
  updateDateDisplay();
});

function renderPrayerTimes(data) {
  const { prayerTimes, currentPrayer, nextPrayer } = data;

  document.getElementById('timeSubuh').textContent = prayerTimes.subuh;
  document.getElementById('timeTerbit').textContent = prayerTimes.terbit;
  document.getElementById('timeDzuhur').textContent = prayerTimes.dzuhur;
  document.getElementById('timeAshar').textContent = prayerTimes.ashar;
  document.getElementById('timeMaghrib').textContent = prayerTimes.maghrib;
  document.getElementById('timeIsya').textContent = prayerTimes.isya;

  const prayerOrder = ['subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  const prayerNameMap = {
    Subuh: 'subuh',
    Terbit: 'terbit',
    Dzuhur: 'dzuhur',
    Ashar: 'ashar',
    Maghrib: 'maghrib',
    Isya: 'isya',
  };

  const currentKey = currentPrayer ? prayerNameMap[currentPrayer] : null;
  const nextKey = nextPrayer ? prayerNameMap[nextPrayer.name] : null;

  let passedCurrent = false;

  prayerOrder.forEach((key) => {
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

  if (nextPrayer) {
    document.getElementById('nextPrayerName').textContent = nextPrayer.name;
  }
}

function startCountdown(data) {
  if (countdownInterval) clearInterval(countdownInterval);

  const { nextPrayer } = data;
  if (!nextPrayer || !nextPrayer.time) return;

  const targetTime = new Date(nextPrayer.time);

  function updateCountdown() {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();

    if (diff <= 0) {
      document.getElementById('countdown').textContent = '00:00:00';
      invoke('refresh_data');
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('countdown').textContent = `${String(hours).padStart(2, '0')}:${String(
      minutes,
    ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateDateDisplay() {
  const now = new Date();

  document.getElementById('masehiDate').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    const correctedDate = new Date(now);
    correctedDate.setDate(correctedDate.getDate() + hijriOffset);

    const hijriFormatter = new Intl.DateTimeFormat('id-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let hijriText = hijriFormatter.format(correctedDate);
    if (hijriOffset !== 0) {
      const sign = hijriOffset > 0 ? '+' : '';
      hijriText += ` (${sign}${hijriOffset})`;
    }
    document.getElementById('hijriDate').textContent = hijriText;
  } catch {
    document.getElementById('hijriDate').textContent = 'Hijriyah';
  }
}

function updateLocation(data) {
  if (data.location) {
    const { city, region } = data.location;
    document.getElementById('cityName').textContent = city
      ? `${city}${region ? ', ' + region : ''}`
      : region || 'Indonesia';
  }
}

updateDateDisplay();
init().catch((e) => console.error('Init failed', e));
