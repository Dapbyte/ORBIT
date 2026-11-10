/**
 * ChatGPTDriver
 * Driver browser untuk chatgpt.com
 */

const BaseDriver = require('./base_driver');

class ChatGPTDriver extends BaseDriver {
  constructor(browserManager, providerConfig) {
    super(browserManager, providerConfig);
    this.providerName = 'chatgpt';
  }

  async isReady() {
    try {
      const page = await this.getPage();
      return await page.evaluate((selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return true;
        }
        return false;
      }, this.config.input_selectors);
    } catch {
      return false;
    }
  }

  async detectRateLimit() {
    try {
      const page = await this.getPage();
      const result = await page.evaluate((patterns) => {
        const alerts = Array.from(document.querySelectorAll('[role="alert"], div[class~="banner"], div[class*="error"], div[class*="toast"]'));
        for (const alertEl of alerts) {
          if (alertEl.closest('[data-message-author-role], .markdown, form, #prompt-textarea, [contenteditable="true"]')) continue;
          if (alertEl.querySelector('form, #prompt-textarea, textarea, [contenteditable="true"]')) continue;

          const text = (alertEl.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { isLimited: true, pattern: p, rawText: alertEl.innerText.trim() };
            }
          }
        }
        return { isLimited: false };
      }, this.config.rate_limit_patterns);

      if (result.isLimited) {
        this.lastRateLimitDetails = result;
      }
      return result.isLimited;
    } catch {
      return false;
    }
  }

  /**
   * Mengatur status mode Berpikir (Thinking Mode) di ChatGPT
   * @param {boolean} enable
   */
  async setThinkingMode(enable = true) {
    try {
      const page = await this.getPage();
      return await page.evaluate((targetState) => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').trim() === 'Berpikir');
        if (!btn) return { found: false };
        const isActive = btn.className.includes('text-info') || btn.getAttribute('aria-pressed') === 'true';
        if (isActive !== targetState) {
          btn.click();
          return { found: true, changed: true, active: targetState };
        }
        return { found: true, changed: false, active: isActive };
      }, enable);
    } catch (err) {
      return { found: false, error: err.message };
    }
  }

  /**
   * Menekan shortcut keyboard resmi Ctrl + Shift + M untuk toggle mode Berpikir
   */
  async toggleThinkingShortcut() {
    try {
      const page = await this.getPage();
      await page.focus('#prompt-textarea, div[contenteditable="true"]');
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('KeyM');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      await new Promise(r => setTimeout(r, 600));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Menunggu ChatGPT berada dalam kondisi IDLE (tidak sedang generate, stream, atau reasoning)
   * Berguna untuk mencegah race condition pengiriman prompt giliran berikutnya (Turn 2+)
   * saat giliran sebelumnya belum tuntas sepenuhnya.
   */
  async waitForIdle(timeoutMs = 120000) {
    const page = await this.getPage();
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const isBusy = await page.evaluate((stopSelectors, streamSelectors) => {
        const isVisible = (el) => {
          if (!el) return false;
          const s = window.getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
        };

        for (const sel of (stopSelectors || [])) {
          const btn = document.querySelector(sel);
          if (isVisible(btn)) return true;
        }

        for (const sel of (streamSelectors || [])) {
          const el = document.querySelector(sel);
          if (isVisible(el)) return true;
        }

        // Cek indikator penalaran / thinking aktif
        const thinkingEls = Array.from(document.querySelectorAll(
          '[data-testid*="thought"], [class*="thought"], [class*="reasoning"], button[aria-label*="Thinking" i]'
        ));
        if (thinkingEls.some(el => isVisible(el) && !el.closest('form, footer, nav'))) {
          return true;
        }

        return false;
      }, this.config.stop_button_selectors, this.config.streaming_selectors);

      if (!isBusy) {
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  async sendMessage(promptText) {
    const page = await this.getPage();
    const ready = await this.waitForReady(15000);
    if (!ready) {
      throw new Error('Halaman ChatGPT belum siap atau input box tidak ditemukan. Pastikan sudah login di chatgpt.com');
    }

    // 0. Pre-Check: Cek segera apakah ChatGPT saat ini sudah dalam status rate limit
    const immediateLimit = await this.detectRateLimit();
    if (immediateLimit) {
      return { sent: false, rateLimited: true };
    }

    // 0b. Pre-Send Busy Guard: Pastikan model tidak sedang streaming / generating respon sebelumnya
    const isIdle = await this.waitForIdle(120000);
    if (!isIdle) {
      throw new Error('ChatGPT masih sibuk menghasilkan respon sebelumnya. Pengiriman prompt giliran baru dibatalkan demi mencegah tabrakan.');
    }

    // Pastikan mode Berpikir aktif jika dikonfigurasi
    if (this.config.default_thinking !== false) {
      await this.setThinkingMode(true);
    }

    // Catat baseline jumlah pesan
    this.initialCount = await this.getMessageCount();

    // 1. Fokus dan masukkan teks ke input composer element (eksklusif, hindari canvas/code editor)
    await page.evaluate((inputSelectors, text) => {
      let inputEl = null;
      for (const sel of inputSelectors) {
        const el = document.querySelector(sel);
        if (el && !el.classList.contains('cm-content')) {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)) {
            inputEl = el;
            break;
          }
        }
      }
      if (!inputEl) throw new Error('Input ChatGPT tidak ditemukan');

      inputEl.focus();
      if (inputEl.tagName.toLowerCase() === 'textarea') {
        inputEl.value = text;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, this.config.input_selectors, promptText);

    await new Promise(r => setTimeout(r, 600));

    // 2. Klik tombol Kirim (Send) menggunakan Native Trusted Click Puppeteer dengan Verifikasi Loop
    let sent = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const sel of this.config.send_button_selectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            const isUsable = await page.evaluate(el => {
              if (el.disabled) return false;
              const s = window.getComputedStyle(el);
              return s.display !== 'none' && s.visibility !== 'hidden' && (el.offsetWidth > 0 || el.getClientRects().length > 0);
            }, btn);
            if (isUsable) {
              await btn.click();
              sent = true;
              break;
            }
          }
        } catch {}
      }

      // Jika tombol kirim belum terpicu, coba tekan Enter pada elemen input composer
      if (!sent) {
        for (const sel of this.config.input_selectors) {
          try {
            const inputEl = await page.$(sel);
            if (inputEl) {
              await inputEl.focus();
              await page.keyboard.press('Enter');
              sent = true;
              break;
            }
          } catch {}
        }
      }

      await new Promise(r => setTimeout(r, 1000));

      // 3. Post-Send Verification Guard:
      // Verifikasi apakah prompt benar-benar dikirim atau teks masih tersangkut di input box
      const verifyState = await page.evaluate((inputSelectors, stopSelectors) => {
        let textRemaining = false;
        for (const sel of inputSelectors) {
          const el = document.querySelector(sel);
          if (el && !el.classList.contains('cm-content')) {
            const val = (el.value || el.innerText || '').trim();
            if (val.length > 0) {
              textRemaining = true;
              break;
            }
          }
        }

        let stopActive = false;
        for (const sel of (stopSelectors || [])) {
          const btn = document.querySelector(sel);
          if (btn && (btn.offsetWidth > 0 || btn.getClientRects().length > 0)) {
            stopActive = true;
            break;
          }
        }

        return { textRemaining, stopActive };
      }, this.config.input_selectors, this.config.stop_button_selectors);

      if (!verifyState.textRemaining || verifyState.stopActive) {
        sent = true;
        break;
      }
      sent = false;
    }

    if (!sent) {
      const limitCheck = await this.detectRateLimit();
      if (limitCheck) {
        return { sent: false, rateLimited: true };
      }
      throw new Error('Gagal mengirim prompt ke ChatGPT: tombol Kirim tidak merespons dan teks masih tertinggal di input box.');
    }

    await new Promise(r => setTimeout(r, 1200));
    const isLimited = await this.detectRateLimit();
    return { sent: true, rateLimited: isLimited };
  }

  /**
   * Mendeteksi apakah terjadi error generasi atau render failure di antarmuka ChatGPT
   * (seperti data-dil-render-failed atau teks "Respons ini tidak dapat dimuat")
   */
  async detectGenerationError() {
    try {
      const page = await this.getPage();
      return await page.evaluate(() => {
        const failedEl = document.querySelector('[data-dil-render-failed]');
        if (failedEl) return { hasError: true, pattern: 'data-dil-render-failed' };
        const text = (document.body.innerText || '').toLowerCase();
        const patterns = [
          'respons ini tidak dapat dimuat',
          'this response could not be loaded',
          'an error occurred while generating'
        ];
        for (const p of patterns) {
          if (text.includes(p)) return { hasError: true, pattern: p };
        }
        return { hasError: false };
      });
    } catch {
      return { hasError: false };
    }
  }

  async waitForResponse(timeoutMs = 420000) {
    const page = await this.getPage();
    const startTime = Date.now();
    let hasStarted = false;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000));

      const isLimited = await this.detectRateLimit();
      if (isLimited) {
        return { success: false, rateLimited: true, text: lastText };
      }

      const currentCount = await this.getMessageCount();

      const state = await page.evaluate((stopSelectors, streamSelectors, msgSelectors, initialCount) => {
        const isVisible = (el) => {
          if (!el) return false;
          const s = window.getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
        };

        let isGenerating = false;
        let isThinking = false;

        for (const sel of (stopSelectors || [])) {
          const btn = document.querySelector(sel);
          if (isVisible(btn)) {
            isGenerating = true;
            break;
          }
        }

        for (const sel of (streamSelectors || [])) {
          const el = document.querySelector(sel);
          if (isVisible(el)) {
            isGenerating = true;
            break;
          }
        }

        // Cek indikator penalaran / thinking aktif (abaikan tombol statis di toolbar/composer)
        const thinkingEls = Array.from(document.querySelectorAll(
          '[data-testid*="thought"], [class*="thought"], [class*="reasoning"], ' +
          'button[aria-label*="Thinking" i]'
        ));
        if (thinkingEls.some(el => isVisible(el) && !el.closest('form, footer, nav'))) {
          isThinking = true;
          isGenerating = true;
        }

        let latestText = '';
        let lastMsgEl = null;
        let currentAssistantCount = 0;
        for (const sel of msgSelectors) {
          const msgs = document.querySelectorAll(sel);
          if (msgs.length > currentAssistantCount) {
            currentAssistantCount = msgs.length;
            lastMsgEl = msgs[msgs.length - 1];
          }
        }

        // HANYA ambil teks jika jumlah pesan asisten saat ini bertambah dibanding initialCount
        if (currentAssistantCount > initialCount && lastMsgEl) {
          latestText = lastMsgEl.innerText || '';
        }

        return {
          isGenerating,
          isThinking,
          text: latestText,
          assistantCount: currentAssistantCount
        };
      }, this.config.stop_button_selectors, this.config.streaming_selectors, this.config.message_selectors, this.initialCount);

      if (state.isGenerating || state.isThinking || currentCount > this.initialCount || (state.text.length > 0 && hasStarted)) {
        hasStarted = true;
      }

      if (!hasStarted && Date.now() - startTime > 15000) {
        const limitCheck = await this.detectRateLimit();
        if (limitCheck) return { success: false, rateLimited: true, text: '' };
      }

      // Penyelesaian hanya sah jika tidak sedang generate, tidak sedang thinking, dan pesan sudah bertambah
      if (hasStarted && !state.isGenerating && !state.isThinking && currentCount > this.initialCount) {
        if (state.text === lastText && state.text.trim().length > 0) {
          stableCount++;
          if (stableCount >= 3) {
            let finalText = await this.extractResponse();
            const errCheck = await this.detectGenerationError();
            if (errCheck.hasError || (finalText && finalText.toLowerCase().includes('respons ini tidak dapat dimuat'))) {
              // Terjadi render failure di antarmuka ChatGPT. Auto-recover via reload halaman dari database OpenAI
              await page.reload({ waitUntil: 'domcontentloaded' });
              await new Promise(r => setTimeout(r, 4500));
              finalText = await this.extractResponse();
              const errCheckAfter = await this.detectGenerationError();
              if (errCheckAfter.hasError) {
                throw new Error(`ChatGPT gagal memuat respons: "${errCheckAfter.pattern}". Silakan coba buat ulang respons.`);
              }
            }
            return { success: true, rateLimited: false, text: (finalText || state.text).trim() };
          }
        } else {
          stableCount = 0;
          lastText = state.text;
        }
      } else if (hasStarted) {
        lastText = state.text;
      }
    }

    if (hasStarted && lastText && lastText.trim().length > 0) {
      let finalText = await this.extractResponse();
      const errCheck = await this.detectGenerationError();
      if (errCheck.hasError || (finalText && finalText.toLowerCase().includes('respons ini tidak dapat dimuat'))) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 4500));
        finalText = await this.extractResponse();
      }
      return { success: true, rateLimited: false, text: (finalText || lastText).trim() };
    }

    throw new Error('Batas waktu (timeout) tercapai saat menunggu jawaban dari ChatGPT');
  }

  /**
   * Ekstraksi respons ChatGPT dengan dukungan ekstraksi kartu artefak dokumen / Canvas
   */
  async extractResponse() {
    const page = await this.getPage();
    try {
      // 1. Cek apakah ada tombol buka pratinjau dokumen/canvas
      const previewBtnClicked = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label*="Buka pratinjau"], button[aria-label*="Open preview"]');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (previewBtnClicked) {
        await new Promise(r => setTimeout(r, 1500));
        const artifactContent = await page.evaluate(() => {
          // Cari teks dari editor canvas atau panel pratinjau
          const docEls = Array.from(document.querySelectorAll('.prose, [data-testid*="canvas"], section[role="dialog"], [role="region"]'));
          const longDocs = docEls.map(e => e.innerText || '').filter(t => t.length > 300);
          if (longDocs.length > 0) {
            longDocs.sort((a, b) => b.length - a.length);
            return longDocs[0];
          }
          return null;
        });

        if (artifactContent && artifactContent.length > 500) {
          return artifactContent;
        }
      }
    } catch {}

    return await super.extractResponse();
  }
}

module.exports = ChatGPTDriver;
