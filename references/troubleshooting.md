# 🛠️ ORBIT Troubleshooting & Operational Recovery

Panduan pemecahan masalah koneksi, peramban Chrome, port CDP, dan penanganan batas kuota.

---

## 1. Browser Chrome Tidak Terhubung (`ECONNREFUSED 127.0.0.1:9222`)
- **Penyebab:** Google Chrome belum berjalan dengan flag debugging `--remote-debugging-port=9222`.
- **Solusi Otomatis:** Jalankan perintah auto-launch bawaan:
  ```bash
  node src/cli.js open
  ```
  Atau via script launcher:
  ```bash
  start_browser.bat
  # atau di PowerShell:
  .\start_browser.ps1
  ```
- **Pemeriksaan Port:** Jalankan `netstat -ano | findstr 9222` di terminal untuk memastikan port terbuka.

---

## 2. Shell Safety Guard `E_INLINE_UNSAFE` (Exit Code 2)
- **Penyebab:** Prompt inline di PowerShell mengandung baris baru (multi-line) atau teks panjang (>300 karakter) yang rentan korupsi shell escaping.
- **Solusi:** Tulis teks prompt ke file sementara (`scratch/prompt.txt`), lalu gunakan bendera `--prompt-file`:
  ```bash
  node src/cli.js ask --prompt-file scratch/prompt.txt
  ```

---

## 3. Rate Limit & Cooldown Lease Reclaim
- **Penyebab:** Kuota model tertentu (Claude/Gemini/Qwen) tercapai di antarmuka web.
- **Perilaku Sistem:** ORBIT otomatis mendeteksi timestamp reset vendor (misal: "Batas direset pada 20.51") dan menyimpan status cooldown ke `cooldown_state.json`. Tugas otomatis dialihkan (*auto-failover*) ke model cadangan dalam rantai (`Claude -> Gemini -> Qwen -> ChatGPT`).
- **Reset Manual:** Untuk menghapus cooldown dan menguji kembali model secara paksa:
  ```bash
  node src/cli.js reset --model gemini
  # Atau reset seluruh tab:
  node src/cli.js reset
  ```

---

## 4. Input Tersangkut di Composer Browser
- **Penyebab:** State React/Lexical pada tab web sedang sibuk atau mengalami race condition.
- **Solusi:** Driver ORBIT dilengkapi `waitForIdle()` dan *Render-Failed Auto-Healing via Reload*. Jika tab tampak tidak merespons, jalankan `node src/cli.js reset` untuk merestart tab ke sesi baru yang bersih.
