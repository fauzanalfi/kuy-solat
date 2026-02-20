<div align="center">

<h1>🕌 Kuy Solat</h1>

<p>Aplikasi jadwal shalat ringan untuk Windows yang bersemayam di <strong>system tray</strong>. Selalu dekat, tidak mengganggu.</p>

[![Platform](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://github.com)
[![Electron](https://img.shields.io/badge/Built%20with-Electron%2028-47848F?logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange)](./package.json)

</div>

---

## ✨ Fitur Unggulan

| Fitur                          | Deskripsi                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| 🗺️ **Deteksi Lokasi Otomatis** | Mendeteksi kota & koordinat GPS pengguna secara otomatis via IP                     |
| 📍 **Lokasi Manual**           | Input nama kota, dikonversi ke koordinat GPS via Photon Geocoding API               |
| 🕐 **Hitung Akurat (Kemenag)** | Kalkulasi waktu shalat menggunakan metode Kementerian Agama RI (Fajr 20°, Isha 18°) |
| ⏱️ **Countdown Real-time**     | Hitungan mundur menuju waktu shalat berikutnya, diperbarui setiap menit             |
| 🔔 **Notifikasi & Adzan**      | Notifikasi Windows pop-up beserta audio adzan saat masuk waktu shalat               |
| 🔇 **Mute Per Waktu Shalat**   | Matikan suara adzan secara selektif untuk masing-masing waktu shalat                |
| 📅 **Tanggal Hijriah**         | Menampilkan tanggal Hijriah dengan fitur koreksi ±1 hari                            |
| 🎨 **4 Tema Visual**           | Pilihan tema: Malam Ungu, Hijau Ketupat, Putih Porselen, Hitam Obsidian             |
| 🔊 **Audio Kustom**            | Pilih file audio adzan sendiri (MP3/WAV) atau gunakan audio bawaan                  |
| 🚀 **Autostart**               | Opsional berjalan otomatis saat Windows menyala                                     |
| 💤 **Resume dari Sleep**       | Memperbarui data jadwal otomatis setelah PC bangun dari mode Sleep/Hibernate        |

---

## 📸 Tampilan

> Klik ikon di system tray → popup jadwal shalat muncul.

```
┌─────────────────────────────────┐
│  − 10 Sya'ban 1446 H +      ✕  │
│    Jum'at, 21 Februari 2026     │
│    📍 Jakarta                   │
├─────────────────────────────────┤
│       Menuju Ashar              │
│         01:23:45                │
├─────────────────────────────────┤
│  🌙  Subuh       04:28          │
│  🌅  Terbit      05:45          │
│  ☀️  Dzuhur      11:52          │
│  🌤️  Ashar       15:12   ◀ now  │
│  🌇  Maghrib     17:58          │
│  🌃  Isya        19:10          │
└─────────────────────────────────┘
```

---

## 🛠️ Teknologi

- **[Electron](https://www.electronjs.org/)** v28 — Desktop app framework
- **[Adhan.js](https://github.com/batoulapps/adhan-js)** — Kalkulasi waktu shalat yang presisi
- **[electron-store](https://github.com/sindresorhus/electron-store)** — Penyimpanan pengaturan pengguna
- **[Photon Geocoding API](https://photon.komoot.io/)** — Konversi nama kota ke koordinat GPS
- **[freeipapi.com](https://freeipapi.com)** — Deteksi lokasi otomatis via IP

---

## 🚀 Memulai (Development)

### Prasyarat

- [Node.js](https://nodejs.org/) v18 atau lebih baru
- npm v9+

### Instalasi

```bash
# Clone repositori ini
git clone https://github.com/username/kuy-solat.git

# Masuk ke direktori proyek
cd kuy-solat

# Install dependensi
npm install
```

### Menjalankan Aplikasi

```bash
npm start
```

Aplikasi akan berjalan dan muncul di **system tray** (pojok kanan bawah taskbar Windows). Klik ikonnya untuk membuka jadwal shalat.

---

## 📦 Build Installer

Untuk menghasilkan file installer Windows (`.exe`):

```bash
# Generate ikon terlebih dahulu (hanya diperlukan sekali)
node generate-icon.js

# Build installer
npm run build
```

File installer akan tersedia di folder `dist/`:

```
dist/
└── Kuy Solat Setup 1.0.0.exe   ← Installer siap pakai
```

> **Catatan:** Proses build pertama kali akan mengunduh beberapa aset (NSIS, winCodeSign) dan membutuhkan koneksi internet.

---

## 📁 Struktur Proyek

```
kuy-solat/
├── main.js                  # Entry point Electron (main process)
├── generate-icon.js         # Script generator ikon PNG 256x256
├── package.json
├── assets/
│   ├── icon.png             # Ikon aplikasi
│   └── adzan.mp3            # Audio adzan bawaan
├── renderer/
│   ├── index.html           # UI utama aplikasi
│   ├── app.js               # Logic renderer (IPC, countdown, UI)
│   └── style.css            # Styling & tema visual
└── src/
    ├── prayer-times.js      # Kalkulasi waktu shalat (Adhan.js)
    ├── location.js          # Deteksi & manajemen lokasi
    ├── notification.js      # Penjadwalan notifikasi & adzan
    └── store.js             # Konfigurasi electron-store
```

---

## ⚙️ Pengaturan

Buka pengaturan dengan mengklik ikon ⚙️ di pojok bawah popup.

| Pengaturan          | Pilihan                                                              |
| ------------------- | -------------------------------------------------------------------- |
| **Tema Visual**     | Malam Ungu / Hijau Ketupat / Putih Porselen / Hitam Obsidian         |
| **Autostart**       | Jalankan otomatis saat Windows startup                               |
| **Audio Adzan**     | Aktifkan/nonaktifkan, pilih file audio kustom                        |
| **Mute per Waktu**  | Matikan suara untuk Subuh, Terbit, Dzuhur, Ashar, Maghrib, atau Isya |
| **Lokasi**          | Otomatis (via IP) atau manual (input nama kota)                      |
| **Koreksi Hijriah** | Tombol +/− untuk menyesuaikan tanggal Hijriah ±1 hari                |

---

## 🤝 Kontribusi

Kontribusi sangat disambut! Silakan:

1. **Fork** repositori ini
2. Buat branch fitur baru: `git checkout -b fitur/nama-fitur`
3. Commit perubahan: `git commit -m 'Tambah fitur: ...'`
4. Push ke branch: `git push origin fitur/nama-fitur`
5. Buka **Pull Request**

Untuk bug atau ide fitur, silakan buka [Issues](https://github.com/username/kuy-solat/issues).

---

## 📋 Changelog

### v1.0.0

- 🎉 Rilis perdana
- Jadwal shalat 6 waktu (Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya)
- Deteksi lokasi otomatis & manual
- Notifikasi dan audio adzan
- Mute selektif per waktu shalat
- Koreksi tanggal Hijriah
- 4 tema visual
- Autostart saat Windows startup
- Installer Windows (NSIS)

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License** — lihat file [LICENSE](./LICENSE) untuk detail.

---

<div align="center">

Dibuat dengan ❤️ oleh **Fauzan** · بسم الله الرحمن الرحيم

</div>
