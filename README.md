<div align="center">

<h1>🕌 Kuy Solat</h1>

<p>Aplikasi jadwal shalat ringan untuk desktop yang bersemayam di <strong>system tray</strong>. Selalu dekat, tidak mengganggu — sekarang berbasis <strong>Tauri 2</strong> (lebih native, lebih hemat resource).</p>

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](https://github.com/fauzanalfi/kuy-solat)
[![Tauri](https://img.shields.io/badge/Built%20with-Tauri%202-24C8DB?logo=tauri)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange)](./package.json)

</div>

---

## ✨ Fitur Unggulan

| Fitur                          | Deskripsi                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| 🗺️ **Deteksi Lokasi Otomatis** | Mendeteksi kota & koordinat GPS pengguna secara otomatis via IP                     |
| 📍 **Lokasi Manual**           | Input nama kota, dikonversi ke koordinat GPS via Photon Geocoding API               |
| 🕐 **Hitung Akurat (Kemenag)** | Kalkulasi waktu shalat Fajr 20°, Isha 18° + ihtiyat 2 menit (via crate `salah`)     |
| ⏱️ **Countdown Real-time**     | Hitungan mundur menuju waktu shalat berikutnya                                      |
| 🔔 **Notifikasi & Adzan**      | Notifikasi native beserta audio adzan saat masuk waktu shalat                       |
| 🔇 **Mute Per Waktu Shalat**   | Matikan suara adzan secara selektif untuk masing-masing waktu shalat                |
| 📅 **Tanggal Hijriah**         | Menampilkan tanggal Hijriah dengan fitur koreksi ±1 hari                            |
| 🎨 **4 Tema Visual**           | Malam Ungu, Hijau Ketupat, Putih Porselen, Hitam Obsidian                           |
| 🔊 **Audio Kustom**            | Pilih file audio adzan sendiri (MP3/WAV/OGG) atau gunakan audio bawaan              |
| 🚀 **Autostart**               | Opsional berjalan otomatis saat sistem menyala                                      |

---

## 🛠️ Teknologi

- **[Tauri 2](https://tauri.app/)** — shell native (Rust) + WebView tipis
- **[salah](https://crates.io/crates/salah)** — kalkulasi waktu shalat (port Adhan)
- **Photon Geocoding API** — konversi nama kota → koordinat
- **freeipapi.com** — deteksi lokasi otomatis via IP
- Frontend vanilla HTML/CSS/JS di folder `renderer/`

---

## 🚀 Memulai (Development)

### Prasyarat

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) stable (1.77+)
- Dependency OS untuk Tauri: lihat [prerequisites](https://v2.tauri.app/start/prerequisites/)

### Instalasi

```bash
git clone https://github.com/fauzanalfi/kuy-solat.git
cd kuy-solat
npm install
```

### Menjalankan

```bash
npm run dev
```

Aplikasi muncul di **system tray**. Klik ikonnya untuk membuka jadwal shalat.

---

## 📦 Build Installer

```bash
# (opsional) regenerate ikon dari assets/icon.png
npm run icon

# Build native installer untuk platform saat ini
npm run build
```

Output ada di `src-tauri/target/release/bundle/` (NSIS/MSI di Windows, deb/AppImage di Linux, dmg di macOS).

---

## 📁 Struktur Proyek

```
kuy-solat/
├── package.json             # Script Tauri CLI + deps frontend API
├── assets/
│   ├── icon.png
│   └── adzan.mp3
├── renderer/                # UI WebView
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── assets/adzan.mp3
└── src-tauri/               # Backend Rust (tray, notifikasi, IPC)
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    └── src/
        ├── main.rs
        ├── lib.rs
        ├── prayer_times.rs
        ├── location.rs
        ├── settings.rs
        ├── notifications.rs
        └── state.rs
```

---

## ⚙️ Pengaturan

Buka pengaturan lewat ikon ⚙️ di pojok bawah popup.

| Pengaturan          | Pilihan                                                      |
| ------------------- | ------------------------------------------------------------ |
| **Tema Visual**     | Malam Ungu / Hijau Ketupat / Putih Porselen / Hitam Obsidian |
| **Autostart**       | Jalankan otomatis saat startup                               |
| **Audio Adzan**     | Aktifkan/nonaktifkan, pilih file audio kustom                |
| **Mute per Waktu**  | Matikan suara untuk Subuh–Isya                               |
| **Lokasi**          | Otomatis (via IP) atau manual (nama kota)                    |
| **Koreksi Hijriah** | Tombol +/− (±1 hari)                                         |

---

## 📋 Changelog

### v2.0.0

- 🚀 Migrasi dari Electron → **Tauri 2** (binary lebih kecil, RAM lebih hemat)
- Backend Rust: tray, notifikasi, lokasi, settings, penjadwalan adzan
- Context isolation bawaan WebView (tanpa `nodeIntegration`)
- Hijri offset & settings disatukan di satu file konfigurasi

### v1.0.0

- Rilis perdana berbasis Electron

---

## 📄 Lisensi

MIT License — lihat [LICENSE](./LICENSE).

<div align="center">

Dibuat dengan ❤️ oleh **Fauzan** · بسم الله الرحمن الرحيم

</div>
