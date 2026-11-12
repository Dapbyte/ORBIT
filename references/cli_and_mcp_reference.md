# 📖 ORBIT CLI & MCP Reference Guide (v2.5)

Panduan parameter lengkap untuk menjalankan ORBIT melalui Antigravity MCP Server maupun perintah baris CLI.

---

## 1. Perintah CLI (`node src/cli.js`)

### Sintaks Dasar
```bash
node src/cli.js <command> [options] [prompt]
```

### Perintah Utama
| Command | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `ask` | Mengirim tugas ke peramban dengan failover & optimasi | `node src/cli.js ask "Audit fungsi auth ini"` |
| `status` | Memeriksa status koneksi Chrome CDP port 9222 dan tab | `node src/cli.js status` |
| `open` / `start-browser` | Membuka Chrome otomatis dengan profil terisolasi | `node src/cli.js open` |
| `reset` | Membersihkan riwayat sesi lokal & merestart tab browser | `node src/cli.js reset` |
| `prompt-optimize` | Menguji sintesis prompt Lyra 4-D tanpa mengirim ke browser | `node src/cli.js prompt-optimize "buat microservice"` |
| `session-list` / `sessions` | Menampilkan seluruh riwayat sesi percakapan aktif | `node src/cli.js session-list` |
| `session-show [id]` | Menampilkan isi giliran obrolan sesi tertentu | `node src/cli.js session-show default` |
| `session-export [id]` | Mengekspor transkrip obrolan ke format Markdown | `node src/cli.js session-export default` |

### Opsi Lengkap Perintah `ask`
- `--model <claude|gemini|qwen|chatgpt>`: Mengarahkan eksekusi ke model spesifik.
- `--files <path1,path2>`: Menginjeksi file proyek langsung dari disk (bypass token).
- `--prompt-file <path>`: Membaca teks prompt dari berkas scratch (bebas shell escaping).
- `--stdin`: Membaca teks prompt melalui pipeline stdin.
- `--session <id>` / `--session-id <id>`: Menentukan ID sesi percakapan multi-thread (default: `default`).
- `--tone <caveman|academic|production>`: Menyesuaikan gaya bahasa jawaban.
- `--reasoning <deep|balanced|quick>`: Mengatur tingkat penalaran model (CoT mendalam vs ringkas).
- `--domain <domain_key>`: Memaksa domain aturan tertentu (misal: `cybersecurity_audit`, `software_engineering`).
- `--tier <1|2|3>`: Tingkat kedalaman evaluasi Evaluator-Optimizer (Tier 1: 1-2 turn, Tier 2: 2-3 turn, Tier 3: 4-5 turn).
- `--no-eval` / `--no-interrogate`: Menonaktifkan loop debat otonom (hanya 1 putaran jawaban langsung).
- `--no-optimize`: Menonaktifkan sintesis prompt Lyra 4-D (kirim teks pengguna apa adanya).
- `--new` / `--reset`: Memulai sesi obrolan baru dan menavigasi tab browser ke URL `/new`.
- `--allow-downgrade`: Mengizinkan penggunaan model Flash-Lite jika Gemini Argon mencapai batas kuota.

---

## 2. Parameter Tool MCP (`ask_web_llm`)

Saat dipanggil dari agen Antigravity via protokol MCP:

```json
{
  "name": "ask_web_llm",
  "arguments": {
    "prompt": "Tolong audit keamanan endpoint API ini",
    "files": ["src/api/auth.ts"],
    "force_model": "claude",
    "session_id": "audit-auth-01",
    "tone": "production",
    "reasoning": "deep",
    "tier": 2,
    "evaluate": true,
    "optimize_prompt": true,
    "reset_session": false
  }
}
```
