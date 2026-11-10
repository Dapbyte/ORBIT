/**
 * ClaudeDriver
 * Driver browser untuk claude.ai
 */

const BaseDriver = require('./base_driver');

class ClaudeDriver extends BaseDriver {
  constructor(browserManager, providerConfig) {
    super(browserManager, providerConfig);
    this.providerName = 'claude';
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
        // Helper untuk memeriksa apakah elemen berada di dalam area input / composer atau bubble pesan
        const isInsideComposerOrMessage = (el) => {
          if (!el) return false;
          return !!el.closest(
            '.font-claude-message, [data-message-author-role], [data-testid="user-message"], [data-testid="assistant-message"], .cds-user-message-body, [data-testid*="transcript"], [class*="message-row"], [class*="message-bubble"], div[contenteditable="true"], .tiptap, .ProseMirror, textarea, fieldset, form, [data-testid*="composer"], [id*="composer"]'
          );
        };

        // Elemen yang membungkus form/composer bukanlah alert banner
        const containsComposer = (el) => {
          return !!el.querySelector('fieldset, form, div[contenteditable="true"], .tiptap, textarea');
        };

        // 1. Periksa elemen alert, dialog, banner spesifik, toast, modal, limit
        // Hindari div[class*="banner"] yang mencocokkan Tailwind var(--organization-banner-column-height)
        const rawCandidates = Array.from(document.querySelectorAll(
          '[role="alert"], [role="dialog"], [data-testid*="banner"], div[class~="banner"], div.df-banner-slot, div.dframe-content-banner, div[class*="toast"], div[class*="modal"], div[class*="notice"]'
        ));

        const alertCandidates = rawCandidates.filter(el => !isInsideComposerOrMessage(el) && !containsComposer(el));

        for (const alertEl of alertCandidates) {
          const text = (alertEl.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { isLimited: true, pattern: p, rawText: alertEl.innerText.trim() };
            }
          }
        }

        // 2. TreeWalker scan untuk teks di luar gelembung pesan chat DAN di luar composer input box
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (!parent || isInsideComposerOrMessage(parent)) continue;
          const val = (node.nodeValue || '').toLowerCase();
          for (const p of patterns) {
            if (val.includes(p.toLowerCase())) {
              const fullText = (parent.innerText || node.nodeValue || '').trim();
              return { isLimited: true, pattern: p, rawText: fullText };
            }
          }
        }

        // 3. Periksa jika tombol send berstatus disabled dan terdapat pola limit pada banner kandidat
        const sendButtons = Array.from(document.querySelectorAll('button[aria-label*="Send"], button[aria-label*="Kirim"]'));
        const isSendDisabled = sendButtons.length > 0 && sendButtons.every(b => b.disabled);
        if (isSendDisabled) {
          for (const alertEl of alertCandidates) {
            const text = (alertEl.innerText || '').toLowerCase();
            for (const p of patterns) {
              if (text.includes(p.toLowerCase())) {
                return { isLimited: true, pattern: p, rawText: alertEl.innerText.trim() };
              }
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
   * Menunggu Claude berada dalam kondisi IDLE (tidak sedang generate, stream, atau tool step running)
   * Berguna untuk mencegah race condition pengiriman prompt giliran berikutnya (Turn 2+)
   */
  async waitForIdle(timeoutMs = 120000) {
    const page = await this.getPage();
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      // Jika sudah terdeteksi limit saat menunggu idle, jangan buang waktu menunggu 120 detik!
      const isLimited = await this.detectRateLimit();
      if (isLimited) return true;

      const isBusy = await page.evaluate((stopSelectors) => {
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

        const isStreaming = !!document.querySelector('[data-is-streaming="true"]');
        if (isStreaming) return true;

        const hasRunningStep = !!Array.from(document.querySelectorAll('[data-cds="TurnStatusStep"]')).find(s => {
          const st = s.getAttribute('data-state');
          return st === 'running' || (s.innerText && s.innerText.toLowerCase().includes('running'));
        });
        if (hasRunningStep) return true;

        return false;
      }, this.config.stop_button_selectors);

      if (!isBusy) {
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  /**
   * Mendeteksi apakah terjadi error generasi pada antarmuka Claude
   */
  async detectGenerationError() {
    try {
      const page = await this.getPage();
      return await page.evaluate((patterns) => {
        const alerts = Array.from(document.querySelectorAll('[role="alert"], div[class*="error"], div[class*="danger"]'));
        for (const el of alerts) {
          const text = (el.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { hasError: true, pattern: p };
            }
          }
        }

        const bodyText = (document.body.innerText || '').toLowerCase();
        for (const p of patterns) {
          if (bodyText.includes(p.toLowerCase())) {
            return { hasError: true, pattern: p };
          }
        }

        return { hasError: false };
      }, this.config.generation_error_patterns || [
        'error generating response',
        'claude had an error',
        'failed to generate',
        'something went wrong',
        'unable to respond',
        'conversation is too long'
      ]);
    } catch {
      return { hasError: false };
    }
  }

  async sendMessage(promptText, options = {}) {
    const page = await this.getPage();
    const ready = await this.waitForReady(15000);
    if (!ready) {
      throw new Error('Halaman Claude belum siap atau input box tidak ditemukan. Pastikan sudah login di claude.ai');
    }

    // 0. Pre-Check: Cek segera apakah Claude saat ini sudah dalam kondisi batas kuota (Rate Limit)
    const immediateLimit = await this.detectRateLimit();
    if (immediateLimit) {
      return { sent: false, rateLimited: true };
    }

    // 0b. Pre-Send Busy Guard: Pastikan model tidak sedang streaming / generating respon sebelumnya
    const isIdle = await this.waitForIdle(120000);
    if (!isIdle) {
      throw new Error('Claude masih sibuk menghasilkan respon sebelumnya. Pengiriman prompt giliran baru dibatalkan demi mencegah tabrakan.');
    }

    // Catat baseline jumlah pesan sebelum mengirim prompt baru
    this.initialCount = await this.getMessageCount();

    // Deteksi apakah ini giliran awal sesi obrolan (Turn 1 / New Chat)
    // Jika tab berada di URL /new, tab ini mutlak sesi baru terlepas dari histori lama.
    const currentUrl = page.url ? page.url() : '';
    const isAtNewChatUrl = currentUrl.endsWith('/new') || currentUrl.includes('claude.ai/new');
    
    let isSessionStart;
    if (isAtNewChatUrl) {
      isSessionStart = true;
    } else if (options.isInitialTurn !== undefined) {
      isSessionStart = options.isInitialTurn;
    } else {
      isSessionStart = (this.initialCount === 0);
    }

    let textToSend = promptText;
    const shouldActivateCaveman = isSessionStart;

    // 1. Fokus dan bersihkan input box
    await page.evaluate((inputSelectors) => {
      let inputEl = null;
      for (const sel of inputSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          inputEl = el;
          break;
        }
      }
      if (!inputEl) throw new Error('Elemen input tidak ditemukan');
      inputEl.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    }, this.config.input_selectors);

    // 1b. Jika sesi chat awal, picu skill /caveman Claude via keyboard
    let cavemanChipActivated = false;
    if (shouldActivateCaveman) {
      try {
        if (page.keyboard && typeof page.keyboard.type === 'function') {
          for (const sel of this.config.input_selectors) {
            const inputHandle = await page.$(sel);
            if (inputHandle) {
              await inputHandle.focus();
              break;
            }
          }
          await page.keyboard.type('/caveman', { delay: 25 });
          await new Promise(r => setTimeout(r, 600));
          await page.keyboard.press('Enter');
          await new Promise(r => setTimeout(r, 600));

          cavemanChipActivated = await page.evaluate(() => {
            return !!document.querySelector('[data-skill-id="caveman"], [class*="node-skillChip"]');
          });
        }
      } catch {
        cavemanChipActivated = false;
      }
    }

    // Tangani prefix /caveman pada textToSend:
    if (cavemanChipActivated) {
      // Jika chip interaktif /caveman sudah berhasil terbentuk di DOM, pangkas prefix dari string agar tidak dobel
      if (textToSend.startsWith('/caveman')) {
        textToSend = textToSend.replace(/^\/caveman\s*/i, '');
      }
    } else if (shouldActivateCaveman && !textToSend.startsWith('/caveman')) {
      // Jika chip tidak terbentuk (misal selector skill berubah), sisipkan /caveman sebagai teks fallback di awal prompt
      textToSend = `/caveman ${textToSend}`;
    }

    // 1c. Masukkan sisa prompt via insertText dengan kursor di akhir
    await page.evaluate((inputSelectors, text) => {
      let inputEl = null;
      for (const sel of inputSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          inputEl = el;
          break;
        }
      }
      if (!inputEl) throw new Error('Elemen input tidak ditemukan');
      inputEl.focus();

      // Pastikan selection kursor berada tepat di ujung akhir input box (setelah chip /caveman)
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('insertText', false, text);
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, this.config.input_selectors, textToSend);

    await new Promise(r => setTimeout(r, 600));

    // Cek segera apakah ada rate limit saat mencoba mengetik
    const limitedImmediate = await this.detectRateLimit();
    if (limitedImmediate) {
      return { sent: false, rateLimited: true };
    }

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

      // Jika tombol kirim belum terpicu, coba tekan Enter pada elemen input
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
          if (el) {
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

        const isStreaming = !!document.querySelector('[data-is-streaming="true"]');
        return { textRemaining, stopActive: stopActive || isStreaming };
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
      throw new Error('Gagal mengirim prompt ke Claude: tombol Kirim tidak merespons dan teks masih tertinggal di input box.');
    }

    await new Promise(r => setTimeout(r, 1200));
    const limitedAfterSend = await this.detectRateLimit();
    if (limitedAfterSend) {
      return { sent: true, rateLimited: true };
    }

    return { sent: true, rateLimited: false };
  }

  async waitForResponse(timeoutMs = 420000) {
    const page = await this.getPage();
    const startTime = Date.now();
    let hasStarted = false;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000));

      // Cek apakah muncul banner limit selama respons
      const isLimited = await this.detectRateLimit();
      if (isLimited) {
        const partial = await this.extractResponse();
        return { success: false, rateLimited: true, text: (partial || lastText).trim() };
      }

      const currentCount = await this.getMessageCount();

      const state = await page.evaluate((stopSelectors, msgSelectors) => {
        const isVisible = (el) => {
          if (!el) return false;
          const s = window.getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
          return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
        };

        let isGenerating = false;
        for (const sel of stopSelectors) {
          const btn = document.querySelector(sel);
          if (isVisible(btn)) {
            isGenerating = true;
            break;
          }
        }

        const isStreaming = !!document.querySelector('[data-is-streaming="true"]');
        if (isStreaming) isGenerating = true;

        // Cek apakah ada langkah alat (tool execution step) yang masih berstatus running
        const hasRunningStep = !!Array.from(document.querySelectorAll('[data-cds="TurnStatusStep"]')).find(s => {
          const st = s.getAttribute('data-state');
          return st === 'running' || (s.innerText && s.innerText.toLowerCase().includes('running'));
        });
        if (hasRunningStep) isGenerating = true;

        // Ambil pesan assistant terakhir
        let latestText = '';
        for (const sel of msgSelectors) {
          const msgs = document.querySelectorAll(sel);
          if (msgs.length > 0) {
            latestText = msgs[msgs.length - 1].innerText || '';
            break;
          }
        }

        return {
          isGenerating,
          text: latestText
        };
      }, this.config.stop_button_selectors, this.config.message_selectors);

      // Verifikasi bahwa ini adalah pesan baru (count bertambah) atau streaming aktif
      if (state.isGenerating || currentCount > this.initialCount || (state.text.length > 0 && hasStarted)) {
        hasStarted = true;
      }

      // Jika sudah 15 detik belum mulai, cek limit sekali lagi
      if (!hasStarted && Date.now() - startTime > 15000) {
        const limitCheck = await this.detectRateLimit();
        if (limitCheck) return { success: false, rateLimited: true, text: '' };
      }

      if (hasStarted && !state.isGenerating) {
        if (state.text === lastText && state.text.trim().length > 0) {
          stableCount++;
          if (stableCount >= 4) {
            let finalText = await this.extractResponse();
            const errCheck = await this.detectGenerationError();
            if (errCheck.hasError) {
              // Jika terjadi error tampilan, coba reload halaman Claude untuk merestorasi teks
              await page.reload({ waitUntil: 'domcontentloaded' });
              await new Promise(r => setTimeout(r, 4500));
              finalText = await this.extractResponse();
              const errCheckAfter = await this.detectGenerationError();
              if (errCheckAfter.hasError) {
                throw new Error(`Claude gagal memuat respons: "${errCheckAfter.pattern}".`);
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
      if (errCheck.hasError) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 4500));
        finalText = await this.extractResponse();
      }
      return { success: true, rateLimited: false, text: (finalText || lastText).trim() };
    }

    throw new Error('Batas waktu (timeout) tercapai saat menunggu jawaban dari Claude');
  }
}

module.exports = ClaudeDriver;
