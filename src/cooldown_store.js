/**
 * cooldown_store.js
 * Penyimpanan status cooldown lintas proses yang atomik dan aman
 * Menyimpan lease prediktif (resetAt) agar proses CLI baru dan MCP Server
 * tidak melakukan probe DOM secara berulang dan boros saat kuota model sedang habis.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_STORE_DIR = path.join(os.homedir(), '.web-llm-orchestrator');
const DEFAULT_STORE_FILE = path.join(DEFAULT_STORE_DIR, 'cooldown_state.json');

class CooldownStore {
  constructor(filePath = DEFAULT_STORE_FILE) {
    this.filePath = filePath;
    this.lockPath = `${this.filePath}.lock`;
  }

  ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  acquireLock(timeoutMs = 5000) {
    const start = Date.now();
    this.ensureDirectory();

    while (Date.now() - start < timeoutMs) {
      try {
        const fd = fs.openSync(this.lockPath, 'wx');
        fs.closeSync(fd);
        return true;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        try {
          const stats = fs.statSync(this.lockPath);
          // Hapus stale lock jika lebih dari 10 detik
          if (Date.now() - stats.mtimeMs > 10000) {
            fs.unlinkSync(this.lockPath);
          }
        } catch {}
        // Sleep sinkron singkat
        const sleepUntil = Date.now() + 25;
        while (Date.now() < sleepUntil) {}
      }
    }
    return false;
  }

  releaseLock() {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch {}
  }

  readAll() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {};
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && data.records) {
        return data.records;
      }
      return {};
    } catch (err) {
      return {};
    }
  }

  writeAll(records) {
    this.ensureDirectory();
    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      records
    };
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  get(provider) {
    const records = this.readAll();
    return records[provider] || null;
  }

  set(provider, record) {
    const locked = this.acquireLock();
    try {
      const records = this.readAll();
      records[provider] = {
        provider,
        blockedAt: record.blockedAt || Date.now(),
        resetAt: record.resetAt || (Date.now() + 3600000),
        source: record.source || 'backoff',
        rawText: record.rawText || '',
        updatedAt: new Date().toISOString()
      };
      this.writeAll(records);
    } finally {
      if (locked) this.releaseLock();
    }
  }

  clear(provider) {
    const locked = this.acquireLock();
    try {
      const records = this.readAll();
      if (records[provider]) {
        delete records[provider];
        this.writeAll(records);
      }
    } finally {
      if (locked) this.releaseLock();
    }
  }

  clearAll() {
    const locked = this.acquireLock();
    try {
      this.writeAll({});
    } finally {
      if (locked) this.releaseLock();
    }
  }
}

module.exports = {
  CooldownStore,
  DEFAULT_STORE_FILE
};
