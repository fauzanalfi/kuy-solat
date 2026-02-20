const { Notification } = require('electron');
const store = require('./store');

let scheduledTimers = [];
let mainWindowRef = null;

/**
 * Menyimpan referensi ke renderer window
 */
function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * Jadwalkan notifikasi untuk semua waktu shalat
 */
function scheduleNotifications(prayerTimes) {
  // Bersihkan timer lama
  clearAllTimers();

  const now = new Date();
  const prayers = [
    { name: 'Subuh', time: prayerTimes.raw.subuh },
    { name: 'Dzuhur', time: prayerTimes.raw.dzuhur },
    { name: 'Ashar', time: prayerTimes.raw.ashar },
    { name: 'Maghrib', time: prayerTimes.raw.maghrib },
    { name: 'Isya', time: prayerTimes.raw.isya }
  ];

  prayers.forEach(prayer => {
    const diff = prayer.time.getTime() - now.getTime();
    if (diff > 0) {
      const timer = setTimeout(() => {
        showNotification(prayer.name, prayer.time);
      }, diff);
      scheduledTimers.push(timer);
    }
  });
}

/**
 * Tampilkan notifikasi Windows dan bunyikan audio jika diaktifkan
 */
function showNotification(prayerName, prayerTime) {
  const timeStr = prayerTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const notification = new Notification({
    title: `🕌 Waktu ${prayerName}`,
    body: `Sudah masuk waktu ${prayerName} (${timeStr}). Ayo segera shalat!`,
    icon: null, // Will use app icon
    silent: false
  });

  notification.show();

  // Cek pengaturan audio
  const audioOptions = store.get('audio');
  if (audioOptions.enabled && mainWindowRef) {
    mainWindowRef.webContents.send('play-adzan', {
      file: audioOptions.file,
      prayerName: prayerName.toLowerCase() // 'subuh', 'dzuhur', dll
    });
  }
}

/**
 * Bersihkan semua timer yang terjadwal
 */
function clearAllTimers() {
  scheduledTimers.forEach(timer => clearTimeout(timer));
  scheduledTimers = [];
}

module.exports = {
  setMainWindow,
  scheduleNotifications,
  showNotification,
  clearAllTimers
};
