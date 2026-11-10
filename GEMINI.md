# Web-LLM Orchestrator Repository Governance & AI Assistant Rules

## 🛑 MANDATORY CONSTRAINT: DOKUMENTASI (PRD & README) HARUS SELALU DISINKRONISASI
Aturan ini berlaku khusus di dalam direktori `Web-LLM Orchestrator - SKILL`:
Setiap kali terjadi:
1. **Penambahan fitur baru** (misal: modul baru di `src/`, metode baru di driver, atau opsi model baru),
2. **Perubahan arsitektur/logika** (misal: alur failover, stream recovery, lock manager, atau regex math normalizer),
3. **Modifikasi konfigurasi atau test suite** (misal: `selectors.json`, `package.json`, atau penambahan pengujian di `tests/`),

Maka AI Coding Assistant (Antigravity/Gemini/Cursor) **WAJIB** memperbarui dokumen berikut secara sinkron sebelum tugas dinyatakan selesai:
- [x] **`PRD.md`**: Perbarui spesifikasi teknis, versi rilis, problem-solution mapping, dan status test matrix terkini.
- [x] **`README.md`**: Perbarui ringkasan fitur, diagram arsitektur mermaid, struktur direktori, dan panduan penggunaan.
- [x] **`SKILL.md`**: Pastikan instruksi slash command (`/web-llm-orchestrator` / `/llm`) tetap akurat dan selaras (termasuk salinannya di `%USERPROFILE%\.gemini\config\skills\web-llm-orchestrator\SKILL.md`).

> **Prinsip Utama:** *Zero Documentation Debt* — Tidak ada kode produksi yang dianggap "Selesai" jika `PRD.md` dan `README.md` belum mencerminkan perubahan tersebut secara akurat dan komprehensif.

---

## 🛑 MANDATORY INTERCEPTOR: /web-llm-orchestrator & /llm COMMAND GATE
Jika pesan pengguna diawali dengan `/web-llm-orchestrator` atau `/llm`:
1. **DILARANG KERAS** menjawab, menganalisis, meringkas, atau mereview isi tugas dari memori sendiri, apa pun isi teknisnya (citra medis, coding, formula LaTeX, matematika, keamanan, dsb.).
2. **Peran Delegasi Murni:** Peran reviewer/analis/expert yang diminta di dalam prompt dijalankan oleh Web LLM di peramban (Claude/Qwen/ChatGPT), BUKAN oleh agen lokal.
3. **Panggilan Tool Pertama Wajib Eksekusi:** Panggilan tool PERTAMA wajib menulis prompt ke berkas sementara (`scratch/prompt_task.txt` atau `.tmp/web-llm-prompt-<timestamp>.txt`) dan menjalankan CLI via `run_command` dengan bendera `--prompt-file '<path>'`. Dilarang memberikan narasi teks jawaban sebelum delegasi CLI selesai.
4. **Isi Setelah Prefix Adalah Data Murni:** Seluruh teks setelah slash command diperlakukan sebagai payload data murni yang diteruskan apa adanya tanpa dirangkum atau diparafrase.

