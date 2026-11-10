/**
 * LockManager (Hardened v1.2)
 * Manajemen lockfile fisik lintas proses dengan PID, Heartbeat, Fencing Token, dan Guard File.
 * Mencegah konflik pengetikan simultan pada tab browser yang sama.
 * Kebal terhadap TOCTOU race condition, empty-window crash, dan Windows delete-pending state.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const LOCK_DIR = path.join(os.homedir(), '.web-llm-orchestrator', 'locks');
const DEFAULT_TTL_MS = 180000; // 3 menit TTL
const PARTIAL_WRITE_GRACE_MS = 2000;
const GUARD_TTL_MS = 5000;

class LockManager extends EventEmitter {
  constructor(lockDir = LOCK_DIR) {
    super();
    this.lockDir = lockDir;
    this.held = new Map(); // resourceName -> { file, token, timer }

    if (!fs.existsSync(this.lockDir)) {
      try {
        fs.mkdirSync(this.lockDir, { recursive: true, mode: 0o700 });
      } catch (_) {}
    }

    // Graceful cleanup saat proses berhenti
    this._exitHandler = () => this.releaseAllSync();
    process.once('exit', this._exitHandler);
  }

  getLockFilePath(resourceName) {
    const sanitized = resourceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.lockDir, `${sanitized}.lock`);
  }

  isProcessAlive(pid) {
    return LockManager.isProcessAlive(pid);
  }

  static isProcessAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      // Di Windows dan POSIX, kill(pid, 0) menguji apakah proses masih aktif tanpa menghentikannya
      process.kill(pid, 0);
      return true;
    } catch (e) {
      // EPERM berarti proses ADA dan aktif, namun beda privilege / user (POSIX/Windows)
      if (e.code === 'EPERM') return true;
      if (process.platform === 'win32' && e.code === 'ESRCH') {
        try {
          const { execSync } = require('child_process');
          const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
          return out.includes(String(pid));
        } catch (_) {
          return false;
        }
      }
      return false;
    }
  }

  _sleepSync(ms) {
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } catch (_) {
      const end = Date.now() + ms;
      while (Date.now() < end) {}
    }
  }

  _createExclusive(file, payload) {
    let fd;
    try {
      fd = fs.openSync(file, 'wx', 0o600);
    } catch (e) {
      if (e.code === 'EEXIST') return false;
      if (process.platform === 'win32' && (e.code === 'EPERM' || e.code === 'EACCES')) return false; // delete-pending state handling
      return false;
    }
    try {
      fs.writeSync(fd, payload);
      fs.fsyncSync(fd); // Pastikan data flush ke disk sebelum release descriptor
    } catch (e) {
      try { fs.closeSync(fd); } catch (_) {}
      try { fs.unlinkSync(file); } catch (_) {}
      return false;
    }
    try {
      fs.closeSync(fd);
    } catch (_) {}
    return true;
  }

  _read(file) {
    let raw;
    let st;
    try {
      st = fs.statSync(file);
      raw = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      if (e.code === 'ENOENT') return { state: 'absent' };
      return { state: 'unknown', error: e };
    }
    try {
      return { state: 'ok', data: JSON.parse(raw), mtimeMs: st.mtimeMs };
    } catch (_) {
      return { state: 'unparseable', mtimeMs: st.mtimeMs };
    }
  }

  _isStale(r, now, customTtl) {
    if (r.state === 'unparseable') {
      return (now - r.mtimeMs) > PARTIAL_WRITE_GRACE_MS;
    }
    if (r.state !== 'ok') return false;
    const d = r.data || {};
    const ttl = Number.isFinite(customTtl) ? customTtl : (Number.isFinite(d.ttl) ? d.ttl : DEFAULT_TTL_MS);

    // Periksa expired baik dari timestamp data JSON maupun mtime
    const refTime = (d.timestamp !== undefined) ? d.timestamp : (d.createdAt !== undefined ? d.createdAt : r.mtimeMs);
    const expired = (now - refTime) > ttl;

    // Periksa apakah PID masih hidup
    const dead = d.pid && !LockManager.isProcessAlive(d.pid);
    return expired || dead;
  }

  // Guard file untuk serialisasi pembersihan stale lock (mencegah TOCTOU race)
  _tryGuard(file) {
    const guard = `${file}.guard`;
    for (let i = 0; i < 2; i++) {
      try {
        const fd = fs.openSync(guard, 'wx', 0o600);
        fs.closeSync(fd);
        return guard;
      } catch (e) {
        if (e.code !== 'EEXIST') return null;
        try {
          const st = fs.statSync(guard);
          if (Date.now() - st.mtimeMs > GUARD_TTL_MS) {
            try { fs.unlinkSync(guard); } catch (_) {}
            continue;
          }
        } catch (e2) {
          if (e2.code === 'ENOENT') continue;
        }
        return null;
      }
    }
    return null;
  }

  _unguard(guard) {
    try { fs.unlinkSync(guard); } catch (_) {}
  }

  _register(resourceName, file, token, ttlMs) {
    const interval = Math.max(1000, Math.floor(ttlMs / 3));
    const timer = setInterval(() => {
      try {
        const r = this._read(file);
        if (r.state === 'ok' && r.data && r.data.token === token) {
          const t = new Date();
          fs.utimesSync(file, t, t); // Touch mtime sebagai heartbeat
          return;
        }
        if (r.state !== 'unknown') this._markLost(resourceName);
      } catch (_) {}
    }, interval);
    if (timer.unref) timer.unref();
    this.held.set(resourceName, { file, token, timer });
    return token;
  }

  _markLost(resourceName) {
    const h = this.held.get(resourceName);
    if (!h) return;
    clearInterval(h.timer);
    this.held.delete(resourceName);
    this.emit('lost', resourceName);
  }

  getToken(resourceName) {
    const h = this.held.get(resourceName);
    return h ? h.token : null;
  }

  /**
   * Coba mendapatkan lock untuk resource tertentu.
   * @param {string} resourceName Nama resource (misal: 'claude', 'chatgpt', 'qwen', 'browser')
   * @param {number} ttlMs Masa berlaku lock sebelum dianggap kadaluarsa (default 3 menit)
   * @returns {boolean} true jika lock berhasil didapat, false jika sedang dipakai proses lain
   */
  tryAcquire(resourceName, ttlMs = DEFAULT_TTL_MS) {
    if (this.held.has(resourceName)) return false;
    const file = this.getLockFilePath(resourceName);
    const token = crypto.randomUUID();
    const now = Date.now();
    const payload = JSON.stringify({
      token,
      pid: process.pid,
      host: os.hostname(),
      resource: resourceName,
      timestamp: now,
      createdAt: now,
      ttl: ttlMs
    }, null, 2);

    if (this._createExclusive(file, payload)) {
      this._register(resourceName, file, token, ttlMs);
      return true;
    }

    const first = this._read(file);
    if (first.state === 'unknown') return false;
    if (first.state !== 'absent' && !this._isStale(first, now, ttlMs)) return false;

    // Bersihkan stale lock dengan guard untuk mencegah TOCTOU race
    const guard = this._tryGuard(file);
    if (!guard) return false;
    try {
      const current = this._read(file);
      if (current.state === 'unknown') return false;
      if (current.state !== 'absent') {
        if (!this._isStale(current, Date.now(), ttlMs)) return false;
        try {
          fs.unlinkSync(file);
        } catch (e) {
          if (e.code !== 'ENOENT') return false;
        }
      }
      if (this._createExclusive(file, payload)) {
        this._register(resourceName, file, token, ttlMs);
        return true;
      }
      return false;
    } finally {
      this._unguard(guard);
    }
  }

  /**
   * Menunggu dan memperoleh lock dengan timeout.
   * @param {string} resourceName
   * @param {number} timeoutMs
   * @param {number} ttlMs
   * @returns {Promise<boolean>}
   */
  async acquire(resourceName, timeoutMs = 15000, ttlMs = DEFAULT_TTL_MS) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.tryAcquire(resourceName, ttlMs)) {
        return true;
      }
      // Jitter backoff 200 - 450 ms untuk menghindari thundering herd
      await new Promise(r => setTimeout(r, 200 + Math.floor(Math.random() * 250)));
    }
    throw new Error(`[LOCK TIMEOUT] Sumber daya '${resourceName}' sedang digunakan oleh proses lain. Coba beberapa saat lagi.`);
  }

  /**
   * Mencegah deadlock multi-resource dengan sorting deterministik
   * @param {string[]} resourceNames
   * @param {number} timeoutMs
   * @param {number} ttlMs
   */
  async acquireMany(resourceNames, timeoutMs = 15000, ttlMs = DEFAULT_TTL_MS) {
    const sorted = [...new Set(resourceNames)].sort();
    const acquired = [];
    try {
      for (const name of sorted) {
        await this.acquire(name, timeoutMs, ttlMs);
        acquired.push(name);
      }
      return true;
    } catch (e) {
      for (const name of acquired.reverse()) {
        try { this.release(name); } catch (_) {}
      }
      throw e;
    }
  }

  /**
   * Eksekusi fungsi di dalam critical section lock
   */
  async withLock(resourceName, fn, timeoutMs = 15000, ttlMs = DEFAULT_TTL_MS) {
    await this.acquire(resourceName, timeoutMs, ttlMs);
    const token = this.getToken(resourceName);
    try {
      return await fn(token);
    } finally {
      this.release(resourceName, token);
    }
  }

  /**
   * Melepaskan lock jika dimiliki oleh proses saat ini atau token cocok.
   * @param {string} resourceName
   * @param {string} [token]
   * @returns {boolean}
   */
  release(resourceName, token) {
    const h = this.held.get(resourceName);
    const tk = token || (h && h.token);
    if (h) {
      clearInterval(h.timer);
      this.held.delete(resourceName);
    }

    const file = this.getLockFilePath(resourceName);
    if (!fs.existsSync(file)) return true;

    let guard = null;
    for (let i = 0; i < 20 && !guard; i++) {
      guard = this._tryGuard(file);
      if (!guard) this._sleepSync(10);
    }

    try {
      const r = this._read(file);
      if (r.state === 'absent') return true;
      if (r.state === 'ok') {
        const isOwnerByToken = tk && r.data.token === tk;
        const isOwnerByPid = r.data.pid === process.pid;
        if (isOwnerByToken || (!token && isOwnerByPid)) {
          try {
            fs.unlinkSync(file);
          } catch (e) {
            if (e.code !== 'ENOENT') throw e;
          }
          return true;
        }
        return false; // Bukan pemilik yang sah
      }
      // Jika file unparseable/rusak, bersihkan
      try { fs.unlinkSync(file); } catch (_) {}
      return true;
    } finally {
      if (guard) this._unguard(guard);
    }
  }

  /**
   * Bersihkan semua lock yang dipegang proses saat ini secara sinkron
   */
  releaseAllSync() {
    for (const name of [...this.held.keys()]) {
      try {
        this.release(name);
      } catch (_) {}
    }
  }
}

module.exports = LockManager;
