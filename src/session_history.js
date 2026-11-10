/**
 * SessionHistory
 * Mengelola riwayat giliran percakapan (turn-by-turn buffer) secara persisten
 * dan menyusun Handoff Bundle saat terjadi perpindahan ke model cadangan.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const GLOBAL_DATA_DIR = path.join(os.homedir(), '.web-llm-orchestrator');
if (!fs.existsSync(GLOBAL_DATA_DIR)) {
  try { fs.mkdirSync(GLOBAL_DATA_DIR, { recursive: true }); } catch {}
}
const STATE_FILE = path.join(GLOBAL_DATA_DIR, 'session_state.json');

class SessionHistory {
  constructor(filePath = STATE_FILE) {
    this.filePath = filePath;
    this.turns = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.turns = JSON.parse(data);
      } else {
        this.turns = [];
      }
    } catch {
      this.turns = [];
    }
  }

  save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.turns, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Gagal menyimpan session state:', err.message);
    }
  }

  addTurn(role, content, provider = null) {
    this.load();
    this.turns.push({
      role,
      content,
      provider,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  getTurns() {
    return this.turns;
  }

  clear() {
    this.turns = [];
    this.save();
  }

  /**
   * Menyusun Handoff Bundle yang berisi N giliran percakapan terakhir
   * ditambah tugas saat ini yang belum terselesaikan (Bounded Context).
   */
  buildHandoffBundle(pendingPrompt, maxTurns = 3) {
    if (this.turns.length === 0) {
      return pendingPrompt;
    }

    // Ambil maksimal N giliran terakhir untuk menghindari context bloat
    const recentTurns = this.turns.slice(-maxTurns * 2);

    const historyLines = recentTurns.map(turn => {
      const author = turn.role === 'user' ? 'User' : (turn.provider ? turn.provider.toUpperCase() : 'Assistant');
      return `[${author}]:\n${turn.content}\n`;
    }).join('\n---\n');

    return (
      `Sesi percakapan ini dialihkan dari Claude karena batas pesan harian tercapai.\n` +
      `Berikut adalah ringkasan konteks dari beberapa giliran obrolan terakhir:\n\n` +
      `--- KONTEKS OBROLAN TERAKHIR ---\n` +
      `${historyLines}\n` +
      `---------------------------------\n\n` +
      `TUGAS LANJUTAN SAAT INI:\n` +
      `${pendingPrompt}\n\n` +
      `Instruksi: Mohon lanjutkan langsung dari titik terakhir tanpa mengulang penjelasan atau poin-poin yang sudah disepakati di atas.`
    );
  }
}

module.exports = SessionHistory;
