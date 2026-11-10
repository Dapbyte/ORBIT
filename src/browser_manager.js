/**
 * BrowserManager (v1.3 Auto-Launch Enabled)
 * Mengelola koneksi Chrome DevTools Protocol (CDP) port 9222
 * dan memastikan tab persisten untuk Claude, Qwen, dan ChatGPT.
 * Mendukung auto-launch visual Chrome jika browser belum aktif.
 */

const puppeteer = require('puppeteer-core');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;
const CDP_URL = `http://${CDP_HOST}:${CDP_PORT}`;

function isPortOpen(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`${CDP_URL}/json/version`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function findChromeExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return 'chrome'; // fallback ke PATH
}

function launchChrome(onLog) {
  const chromePath = findChromeExecutable();
  const profileDir = path.join(os.homedir(), '.web-llm-orchestrator', 'chrome-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const args = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    'https://claude.ai',
    'https://chat.qwen.ai',
    'https://chatgpt.com',
    'https://gemini.google.com/app?hl=id'
  ];

  if (typeof onLog === 'function') {
    onLog('[BrowserManager] Membuka Google Chrome secara otomatis...');
  }

  const child = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false // Jendela browser tampil visual normal di desktop
  });
  child.unref();
}

async function ensureChromeRunning(onLog, maxWaitMs = 15000) {
  if (await isPortOpen(1000)) {
    return true;
  }

  launchChrome(onLog);

  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 600));
    if (await isPortOpen(1000)) {
      if (typeof onLog === 'function') {
        onLog('[BrowserManager] Google Chrome siap terhubung pada port 9222.');
      }
      return true;
    }
  }

  throw new Error(
    `Google Chrome telah dijalankan otomatis, namun port remote debugging 9222 belum siap setelah ${maxWaitMs / 1000} detik.\n` +
    `Pastikan tidak ada instance Chrome lain yang bentrok dengan profil ini.`
  );
}

class BrowserManager {
  constructor(selectors) {
    this.selectors = selectors;
    this.browser = null;
    this.tabs = {
      claude: null,
      qwen: null,
      chatgpt: null,
      gemini: null
    };
  }

  async connect(onLog) {
    const alive = await isPortOpen();
    if (!alive) {
      await ensureChromeRunning(onLog);
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.browser = await puppeteer.connect({
          browserURL: CDP_URL,
          defaultViewport: null
        });

        // Deteksi disconnect dan reset state
        this.browser.on('disconnected', () => {
          this.browser = null;
          this.tabs = { claude: null, qwen: null, chatgpt: null, gemini: null };
        });

        return this.browser;
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, 800));
      }
    }

    throw new Error(`Gagal menghubungkan ke Chrome CDP: ${lastError ? lastError.message : 'Unknown error'}`);
  }

  async ensureBrowser(onLog) {
    const isConn = this.browser && (typeof this.browser.isConnected === 'function' ? this.browser.isConnected() : !!this.browser.connected);
    if (!isConn) {
      await this.connect(onLog);
    }
    return this.browser;
  }

  async getTab(provider, onLog) {
    await this.ensureBrowser(onLog);
    const config = this.selectors[provider];
    if (!config) {
      throw new Error(`Provider tidak dikenal: ${provider}`);
    }

    // Cek apakah cache tab masih hidup
    if (this.tabs[provider] && !this.tabs[provider].isClosed()) {
      try { await this.tabs[provider].bringToFront(); } catch (_) {}
      return this.tabs[provider];
    }

    // Toleransi waktu untuk tab termuat jika Chrome baru saja di-spawn
    const startTime = Date.now();
    let page = null;
    while (Date.now() - startTime < 6000) {
      const pages = await this.browser.pages();
      page = pages.find(p => p.url().includes(config.url_pattern));
      if (page) break;
      await new Promise(r => setTimeout(r, 600));
    }

    // Jika belum ada tab yang terbuka untuk provider ini, buat tab baru
    if (!page) {
      page = await this.browser.newPage();
      await page.goto(config.home_url, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 2000));
    }

    try { await page.bringToFront(); } catch (_) {}
    await this.injectSilentKeepAwake(page);
    this.tabs[provider] = page;
    return page;
  }

  /**
   * Silent Web Audio Keep-Awake Injector
   * Menginjeksikan osilator audio 1 Hz inaudible via Web Audio API.
   * Menandai tab sebagai active audio player sehingga Chrome Memory Saver / Sleeping Tabs
   * tidak men-suspend atau membuang tab dari memori saat fasa deep thinking (60-120 detik).
   */
  async injectSilentKeepAwake(page) {
    if (!page || page.isClosed()) return;
    try {
      await page.evaluate(() => {
        if (window.__webLlmAudioKeepAwake) return;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 1; // 1 Hz
          gain.gain.value = 0.0001; // Inaudible
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          window.__webLlmAudioKeepAwake = ctx;
        } catch (_) {}
      });
    } catch (_) {}
  }

  async resetTabs(onLog, targetProvider = null) {
    const alive = await isPortOpen();
    if (!alive) return;
    try {
      await this.ensureBrowser(onLog);
      const pages = await this.browser.pages();
      for (const [provider, config] of Object.entries(this.selectors)) {
        if (targetProvider && targetProvider !== provider) continue;
        if (!config || !config.home_url) continue;
        const page = pages.find(p => p.url().includes(config.url_pattern));
        if (page) {
          const targetUrl = provider === 'claude' ? 'https://claude.ai/new' : config.home_url;
          if (typeof onLog === 'function') {
            onLog(`[BrowserManager] Mereset tab ${provider} ke sesi baru (${targetUrl})...`);
          }
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
      if (targetProvider) {
        this.tabs[targetProvider] = null;
      } else {
        this.tabs = { claude: null, qwen: null, chatgpt: null, gemini: null };
      }
    } catch (err) {
      if (typeof onLog === 'function') {
        onLog(`[BrowserManager] Peringatan saat reset tab: ${err.message}`);
      }
    }
  }

  async getStatus() {
    const alive = await isPortOpen();
    if (!alive) {
      return {
        online: false,
        message: 'Chrome saat ini belum aktif. Browser akan otomatis dibuka saat prompt dikirim.'
      };
    }

    try {
      await this.ensureBrowser();
      const pages = await this.browser.pages();

      const claudePage = pages.find(p => p.url().includes('claude.ai'));
      const qwenPage = pages.find(p => p.url().includes('chat.qwen.ai'));
      const chatgptPage = pages.find(p => p.url().includes('chatgpt.com'));
      const geminiPage = pages.find(p => p.url().includes('gemini.google.com'));

      return {
        online: true,
        claude: {
          available: !!claudePage,
          url: claudePage ? claudePage.url() : null
        },
        qwen: {
          available: !!qwenPage,
          url: qwenPage ? qwenPage.url() : null
        },
        chatgpt: {
          available: !!chatgptPage,
          url: chatgptPage ? chatgptPage.url() : null
        },
        gemini: {
          available: !!geminiPage,
          url: geminiPage ? geminiPage.url() : null
        }
      };
    } catch (err) {
      return {
        online: false,
        error: err.message
      };
    }
  }

  async disconnect() {
    try {
      if (this.browser && this.browser.isConnected()) {
        await this.browser.disconnect();
      }
    } catch {}
    this.browser = null;
    this.tabs = { claude: null, qwen: null, chatgpt: null, gemini: null };
  }
}

module.exports = { BrowserManager, isPortOpen, ensureChromeRunning };
