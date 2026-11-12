/**
 * SessionHistory (v2.5 Multi-Session & Context Compaction)
 * Mengelola riwayat percakapan per-sesi secara persisten, mendukung thread isolation,
 * metadata tracking, context compaction, dan penyusunan dynamic Handoff Bundle saat failover.
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
  constructor(filePath = STATE_FILE, sessionId = 'default') {
    this.filePath = filePath;
    this.activeSessionId = sessionId || 'default';
    this.sessions = {};
    this.turns = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);

        // Kompatibilitas ke belakang: jika file lama menyimpan array flat murni
        if (Array.isArray(parsed)) {
          this.sessions = {
            default: {
              id: 'default',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: {},
              turns: parsed
            }
          };
          this.activeSessionId = 'default';
        } else if (parsed && typeof parsed === 'object') {
          this.sessions = parsed.sessions || {};
          if (parsed.activeSessionId && !this.activeSessionId) {
            this.activeSessionId = parsed.activeSessionId;
          }
        }
      }
    } catch {
      this.sessions = {};
    }

    // Pastikan activeSession ada
    if (!this.sessions[this.activeSessionId]) {
      this.sessions[this.activeSessionId] = {
        id: this.activeSessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {},
        turns: []
      };
    }

    this.turns = this.sessions[this.activeSessionId].turns || [];
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!this.sessions[this.activeSessionId]) {
        this.sessions[this.activeSessionId] = {
          id: this.activeSessionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {},
          turns: this.turns
        };
      } else {
        this.sessions[this.activeSessionId].turns = this.turns;
        this.sessions[this.activeSessionId].updatedAt = new Date().toISOString();
      }

      const payload = {
        version: '2.5.0',
        activeSessionId: this.activeSessionId,
        sessions: this.sessions
      };

      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Gagal menyimpan session state:', err.message);
    }
  }

  switchSession(sessionId = 'default') {
    this.save();
    this.activeSessionId = sessionId;
    this.load();
    return this.getStats();
  }

  listSessions() {
    this.load();
    return Object.keys(this.sessions).map(id => {
      const sess = this.sessions[id];
      return {
        id,
        turnCount: (sess.turns || []).length,
        createdAt: sess.createdAt,
        updatedAt: sess.updatedAt,
        metadata: sess.metadata || {}
      };
    });
  }

  setMetadata(key, value) {
    if (!this.sessions[this.activeSessionId]) {
      this.sessions[this.activeSessionId] = { id: this.activeSessionId, turns: this.turns, metadata: {} };
    }
    if (!this.sessions[this.activeSessionId].metadata) {
      this.sessions[this.activeSessionId].metadata = {};
    }
    this.sessions[this.activeSessionId].metadata[key] = value;
    this.save();
  }

  getMetadata() {
    return (this.sessions[this.activeSessionId] && this.sessions[this.activeSessionId].metadata) || {};
  }

  addTurn(role, content, provider = null, meta = {}) {
    this.load();
    const newTurn = {
      role,
      content,
      provider,
      meta,
      timestamp: new Date().toISOString()
    };
    this.turns.push(newTurn);
    // Auto-compaction jika giliran melampaui 100
    if (this.turns.length > 100) {
      this.compact(50);
    }
    this.save();
  }

  getTurns() {
    return this.turns;
  }

  clear() {
    this.turns = [];
    if (this.sessions[this.activeSessionId]) {
      this.sessions[this.activeSessionId].turns = [];
      this.sessions[this.activeSessionId].updatedAt = new Date().toISOString();
    }
    this.save();
  }

  compact(maxTurns = 50) {
    if (this.turns.length <= maxTurns) return;
    const keptTurns = this.turns.slice(-maxTurns);
    const prunedCount = this.turns.length - keptTurns.length;
    this.turns = [
      {
        role: 'system',
        content: `[SYSTEM: ${prunedCount} giliran percakapan terdahulu dipadatkan untuk menghemat memori]`,
        timestamp: new Date().toISOString()
      },
      ...keptTurns
    ];
  }

  getStats() {
    const userTurns = this.turns.filter(t => t.role === 'user').length;
    const assistantTurns = this.turns.filter(t => t.role === 'assistant').length;
    const providers = [...new Set(this.turns.map(t => t.provider).filter(Boolean))];
    const totalChars = this.turns.reduce((acc, t) => acc + (t.content ? t.content.length : 0), 0);

    return {
      sessionId: this.activeSessionId,
      turnCount: this.turns.length,
      userTurns,
      assistantTurns,
      providers,
      totalChars,
      updatedAt: (this.sessions[this.activeSessionId] && this.sessions[this.activeSessionId].updatedAt) || null
    };
  }

  exportMarkdown() {
    const lines = [
      `# 🪐 ORBIT Session Transcript (${this.activeSessionId})`,
      `*Generated: ${new Date().toISOString()}*\n`
    ];

    for (const turn of this.turns) {
      const author = turn.role === 'user' ? '👤 **User**' : `🤖 **Assistant (${turn.provider ? turn.provider.toUpperCase() : 'Unknown'})**`;
      lines.push(`### ${author} [${turn.timestamp}]`);
      lines.push(`${turn.content}\n`);
    }

    return lines.join('\n');
  }

  /**
   * Menyusun Handoff Bundle yang berisi N giliran percakapan terakhir
   * ditambah tugas saat ini yang belum terselesaikan (Bounded Context).
   */
  buildHandoffBundle(pendingPrompt, maxTurnsOrOptions = 3, options = {}) {
    if (this.turns.length === 0) {
      return pendingPrompt;
    }

    let maxTurns = 3;
    let fromProvider = null;

    if (typeof maxTurnsOrOptions === 'object') {
      maxTurns = maxTurnsOrOptions.maxTurns || 3;
      fromProvider = maxTurnsOrOptions.fromProvider || null;
    } else {
      maxTurns = maxTurnsOrOptions || 3;
      fromProvider = options.fromProvider || null;
    }

    // Jika fromProvider tidak ditentukan eksplisit, deteksi dari giliran asisten terakhir
    if (!fromProvider) {
      const lastAssistant = [...this.turns].reverse().find(t => t.role === 'assistant' && t.provider);
      fromProvider = lastAssistant ? lastAssistant.provider : 'Claude';
    }

    const providerTitle = fromProvider.charAt(0).toUpperCase() + fromProvider.slice(1);

    // Ambil maksimal N giliran terakhir untuk menghindari context bloat
    const recentTurns = this.turns.slice(-maxTurns * 2);

    const historyLines = recentTurns.map(turn => {
      const author = turn.role === 'user' ? 'User' : (turn.provider ? turn.provider.toUpperCase() : 'Assistant');
      return `[${author}]:\n${turn.content}\n`;
    }).join('\n---\n');

    const switchNotice = fromProvider.toLowerCase() === 'claude'
      ? 'Sesi percakapan ini dialihkan dari Claude karena batas pesan harian tercapai.'
      : `Sesi percakapan ini dialihkan dari ${providerTitle} karena batas pesan/kuota tercapai.`;

    return (
      `${switchNotice}\n` +
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

