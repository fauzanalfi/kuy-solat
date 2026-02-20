const adhan = require("adhan");

/**
 * Menghitung jadwal sholat untuk tanggal dan koordinat tertentu
 */
function getPrayerTimes(latitude, longitude, date = new Date()) {
  const coordinates = new adhan.Coordinates(latitude, longitude);

  // Menggunakan method kalkulasi Kementerian Agama RI (Kemenag)
  // Kemenag menggunakan sudut Fajr 20 derajat dan Isha 18 derajat.
  // Ditambah ihtiyat (waktu pengaman) sebesar rata-rata 2 menit.
  const params = new adhan.CalculationParameters(20, 18);
  params.madhab = adhan.Madhab.Shafi;
  params.adjustments.fajr = 2;
  params.adjustments.dhuhr = 2;
  params.adjustments.asr = 2;
  params.adjustments.maghrib = 2;
  params.adjustments.isha = 2;

  const prayerTimes = new adhan.PrayerTimes(coordinates, date, params);

  return {
    fajr: prayerTimes.fajr,
    sunrise: prayerTimes.sunrise,
    dhuhr: prayerTimes.dhuhr,
    asr: prayerTimes.asr,
    maghrib: prayerTimes.maghrib,
    isha: prayerTimes.isha,
    _raw: prayerTimes,
  };
}

/**
 * Format waktu ke HH:mm
 */
function formatTime(date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Mendapatkan jadwal shalat dalam format yang sudah siap ditampilkan
 */
function getFormattedPrayerTimes(latitude, longitude, date = new Date()) {
  const times = getPrayerTimes(latitude, longitude, date);

  return {
    subuh: formatTime(times.fajr),
    terbit: formatTime(times.sunrise),
    dzuhur: formatTime(times.dhuhr),
    ashar: formatTime(times.asr),
    maghrib: formatTime(times.maghrib),
    isya: formatTime(times.isha),
    raw: {
      subuh: times.fajr,
      terbit: times.sunrise,
      dzuhur: times.dhuhr,
      ashar: times.asr,
      maghrib: times.maghrib,
      isya: times.isha,
    },
  };
}

/**
 * Mendapatkan waktu shalat berikutnya
 */
function getNextPrayer(latitude, longitude) {
  const now = new Date();
  const times = getPrayerTimes(latitude, longitude, now);
  const prayerNames = {
    fajr: "Subuh",
    sunrise: "Terbit",
    dhuhr: "Dzuhur",
    asr: "Ashar",
    maghrib: "Maghrib",
    isha: "Isya",
  };

  const nextPrayer = times._raw.nextPrayer();

  if (nextPrayer === adhan.Prayer.None) {
    // Sudah lewat Isya, ambil Subuh besok
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = getPrayerTimes(latitude, longitude, tomorrow);
    return {
      name: "Subuh",
      time: tomorrowTimes.fajr,
      formatted: formatTime(tomorrowTimes.fajr),
    };
  }

  const prayerKey = Object.keys(adhan.Prayer).find(
    (key) => adhan.Prayer[key] === nextPrayer,
  );

  const prayerKeyLower = prayerKey ? prayerKey.toLowerCase() : "fajr";

  return {
    name: prayerNames[prayerKeyLower] || prayerKeyLower,
    time: times[prayerKeyLower],
    formatted: formatTime(times[prayerKeyLower]),
  };
}

/**
 * Mendapatkan waktu shalat yang sedang berlangsung (current prayer)
 */
function getCurrentPrayer(latitude, longitude) {
  const now = new Date();
  const times = getPrayerTimes(latitude, longitude, now);
  const prayerNames = {
    fajr: "Subuh",
    sunrise: "Terbit",
    dhuhr: "Dzuhur",
    asr: "Ashar",
    maghrib: "Maghrib",
    isha: "Isya",
  };

  const currentPrayer = times._raw.currentPrayer();

  if (currentPrayer === adhan.Prayer.None) {
    return null;
  }

  const prayerKey = Object.keys(adhan.Prayer).find(
    (key) => adhan.Prayer[key] === currentPrayer,
  );

  const prayerKeyLower = prayerKey ? prayerKey.toLowerCase() : null;

  return prayerKeyLower ? prayerNames[prayerKeyLower] : null;
}

module.exports = {
  getPrayerTimes,
  getFormattedPrayerTimes,
  getNextPrayer,
  getCurrentPrayer,
  formatTime,
};
