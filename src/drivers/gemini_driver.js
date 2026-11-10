/**
 * GeminiDriver
 * Driver browser untuk gemini.google.com (Google Gemini: Gemini 4 Argon & 3.8 Flash)
 * Mendukung pemilihan model (Argon/Flash), tingkat penalaran (Tinggi/Sedang/Rendah),
 * mode segmented ("Percakapan" vs "Tugas"), Long Thinking Silence telemetry,
 * dan preservasi formula KaTeX non-destruktif.
 */

const BaseDriver = require('./base_driver');

class GeminiDriver extends BaseDriver {
  constructor(browserManager, providerConfig) {
    super(browserManager, providerConfig);
    this.providerName = 'gemini';
  }

  async isReady() {
    try {
      const page = await this.getPage();
      return await page.evaluate((selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null && !el.disabled) return true;
        }
        return false;
      }, this.config.input_selectors);
    } catch {
      return false;
    }
  }

  /**
   * Menunggu Gemini berada dalam kondisi IDLE (tidak sedang menalar atau streaming respons)
   */
  async waitForIdle(timeoutMs = 120000) {
    const page = await this.getPage();
    if (!page) return true;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
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

        const thinkingIndicator = document.querySelector('.thoughts-status-message, [aria-label*="Sedang menalar"]');
        if (isVisible(thinkingIndicator)) return true;

        return false;
      }, this.config.stop_button_selectors);

      if (!isBusy) {
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  async getMessageCount() {
    try {
      const page = await this.getPage();
      return await page.evaluate((selectors) => {
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) return els.length;
        }
        return document.querySelectorAll('model-response').length;
      }, this.config.message_selectors);
    } catch {
      return 0;
    }
  }

  async detectRateLimit(options = {}) {
    if (options.allowDowngrade) {
      return false;
    }
    try {
      const page = await this.getPage();
      const checkBadge = options.checkBadge !== false;
      const result = await page.evaluate((patterns, toastSelectors, targetModel, checkBadge) => {
        // 1. Cek Model Badge di composer jika checkBadge aktif
        if (checkBadge) {
          const triggerBtn = document.querySelector('[data-test-id="bard-mode-menu-button"] button, button[aria-label*="pemilih mode"], [data-test-id="bard-mode-menu-button"]');
          if (triggerBtn) {
            const badge = (triggerBtn.innerText || '').trim().toLowerCase();
            const aria = (triggerBtn.getAttribute('aria-label') || '').toLowerCase();
            if ((badge.includes('flash-lite') || aria.includes('flash-lite')) && (targetModel || '4 Argon').toLowerCase().includes('argon')) {
              return { isLimited: true, pattern: 'silent_downgrade_to_flash_lite', source: 'model_badge', rawText: triggerBtn.innerText.trim() };
            }
          }
        }

        // 2. Cek apakah ada teks "batas direset pada" di menu atau alert mana pun
        const menuItems = Array.from(document.querySelectorAll('gem-menu-item, [role="menuitem"], .mat-mdc-menu-item, [role="option"]'));
        for (const item of menuItems) {
          const text = (item.innerText || '').toLowerCase();
          const isDisabled = item.getAttribute('aria-disabled') === 'true' || item.disabled || item.className.includes('disabled');
          if (text.includes('argon') && (isDisabled || text.includes('batas direset') || text.includes('limit resets'))) {
            return { isLimited: true, pattern: '4_argon_quota_disabled', source: 'menu_item', rawText: item.innerText.trim() };
          }
        }

        // 3. Cek Material Snackbar / Toast / Alert
        const alertNodes = [];
        for (const sel of toastSelectors) {
          document.querySelectorAll(sel).forEach(el => alertNodes.push(el));
        }

        for (const node of alertNodes) {
          // Abaikan jika berada di dalam pesan pengguna atau editor input
          if (node.closest('user-query, rich-textarea, .ql-editor, form')) continue;
          const text = (node.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { isLimited: true, pattern: p, source: 'toast', rawText: node.innerText.trim() };
            }
          }
        }

        // 4. Cek banner umum di luar chat content
        const banners = Array.from(document.querySelectorAll('div[role="alert"], div[class~="banner"], div[class*="error-message"]'));
        for (const b of banners) {
          if (b.closest('user-query, model-response, rich-textarea, .ql-editor')) continue;
          const text = (b.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { isLimited: true, pattern: p, source: 'banner', rawText: b.innerText.trim() };
            }
          }
        }

        return { isLimited: false };
      }, this.config.rate_limit_patterns, this.config.toast_selectors || ['snack-bar-container', '[role="alert"]'], this.config.default_model || '4 Argon', checkBadge);

      if (result.isLimited) {
        this.lastRateLimitDetails = result;
      }
      return result.isLimited;
    } catch {
      return false;
    }
  }

  /**
   * Mendeteksi apakah terjadi error generasi pada antarmuka Gemini
   */
  async detectGenerationError() {
    try {
      const page = await this.getPage();
      return await page.evaluate((patterns) => {
        const alerts = Array.from(document.querySelectorAll('[role="alert"], div[class*="error"], div[class*="danger"], snack-bar-container'));
        for (const el of alerts) {
          if (el.closest('user-query, rich-textarea, .ql-editor')) continue;
          const text = (el.innerText || '').toLowerCase();
          for (const p of patterns) {
            if (text.includes(p.toLowerCase())) {
              return { hasError: true, pattern: p };
            }
          }
        }
        return { hasError: false };
      }, this.config.generation_error_patterns || [
        'respons ini tidak dapat dimuat',
        'something went wrong',
        'terjadi kesalahan',
        'tidak dapat merespons saat ini'
      ]);
    } catch {
      return { hasError: false };
    }
  }

  /**
   * Memilih model di UI Gemini (default: "4 Argon" atau "3.8 Flash")
   */
  async selectModel(targetModelName = '4 Argon', options = {}) {
    try {
      const page = await this.getPage();
      const triggerSel = this.config.model_trigger_selector || '[data-test-id="bard-mode-menu-button"] button, button[aria-label*="pemilih mode"], [data-test-id="bard-mode-menu-button"]';
      
      const currentModel = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? (el.innerText || el.getAttribute('aria-label') || '').trim() : null;
      }, triggerSel);

      const targetKeyword = targetModelName.toLowerCase().includes('flash') ? 'flash' : 'argon';

      if (currentModel && currentModel.toLowerCase().includes(targetKeyword) && !currentModel.toLowerCase().includes('flash-lite')) {
        return { success: true, model: currentModel, changed: false };
      }

      // Jika allowDowngrade aktif dan saat ini berada di Flash-Lite, izinkan tanpa error
      if (options.allowDowngrade && currentModel && currentModel.toLowerCase().includes('flash-lite')) {
        return { success: true, model: currentModel, changed: false, downgraded: true };
      }

      // Buka dropdown model
      const triggerBtn = await page.$(triggerSel);
      if (!triggerBtn) return { success: false, reason: 'Trigger button not found' };

      await triggerBtn.click();
      await new Promise(r => setTimeout(r, 800));

      const selectionResult = await page.evaluate((kw) => {
        const items = Array.from(document.querySelectorAll('gem-menu-item, [role="menuitem"], .mat-mdc-menu-item, [role="option"]'));
        const target = items.find(it => (it.innerText || '').toLowerCase().includes(kw));
        if (!target) {
          return { found: false };
        }
        const text = (target.innerText || '').toLowerCase();
        const isDisabled = target.getAttribute('aria-disabled') === 'true' || target.disabled || target.className.includes('disabled');
        const hasResetNotice = text.includes('batas direset') || text.includes('limit resets') || text.includes('kuota');

        if (isDisabled || hasResetNotice) {
          return { found: true, disabled: true, text: target.innerText.trim() };
        }

        target.click();
        return { found: true, disabled: false };
      }, targetKeyword);

      if (!selectionResult.found || selectionResult.disabled) {
        await page.keyboard.press('Escape');
        if (selectionResult.disabled) {
          if (options.allowDowngrade) {
            return { success: true, model: currentModel || 'Flash-Lite', changed: false, downgraded: true };
          }
          this.lastRateLimitDetails = {
            isLimited: true,
            pattern: '4_argon_quota_disabled',
            source: 'menu_item',
            resetText: selectionResult.text,
            rawText: selectionResult.text
          };
          return {
            success: false,
            rateLimited: true,
            reason: `Model ${targetModelName} sedang mencapai batas kuota (${selectionResult.text})`,
            resetText: selectionResult.text
          };
        }
        return { success: false, reason: `Menu item for keyword "${targetKeyword}" not found` };
      }

      await new Promise(r => setTimeout(r, 1000));
      const updatedModel = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? (el.innerText || el.getAttribute('aria-label') || '').trim() : null;
      }, triggerSel);

      if (!updatedModel || !updatedModel.toLowerCase().includes(targetKeyword) || updatedModel.toLowerCase().includes('flash-lite')) {
        if (options.allowDowngrade) {
          return { success: true, model: updatedModel || currentModel, changed: false, downgraded: true };
        }
        return {
          success: false,
          rateLimited: true,
          reason: `Model ${targetModelName} tidak dapat diaktifkan (tetap pada ${updatedModel}). Terjadi silent downgrade akibat kuota limit.`
        };
      }

      return { success: true, model: updatedModel, changed: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Mengatur tingkat penalaran untuk model Argon (Tinggi / Sedang / Rendah)
   */
  async setReasoningLevel(targetLevel = 'Tinggi') {
    try {
      const page = await this.getPage();
      const triggerSel = this.config.model_trigger_selector || '[data-test-id="bard-mode-menu-button"] button';
      const triggerBtn = await page.$(triggerSel);
      if (!triggerBtn) return { success: false };

      await triggerBtn.click();
      await new Promise(r => setTimeout(r, 800));

      const res = await page.evaluate((lvl) => {
        const items = Array.from(document.querySelectorAll('gem-menu-item, [role="menuitem"]'));
        const target = items.find(it => (it.innerText || '').toLowerCase().includes(lvl.toLowerCase()));
        if (target) {
          target.click();
          return { success: true, text: target.innerText.trim() };
        }
        return { success: false };
      }, targetLevel);

      await new Promise(r => setTimeout(r, 800));
      return res;
    } catch {
      return { success: false };
    }
  }

  /**
   * Mengatur mode segmented toggle: "Percakapan" vs "Tugas"
   */
  async selectMode(targetMode = 'Percakapan') {
    try {
      const page = await this.getPage();
      return await page.evaluate((mode) => {
        const buttons = Array.from(document.querySelectorAll('chat-spark-toggle button, gem-segmented-button button'));
        const btn = buttons.find(b => b.innerText.trim().toLowerCase() === mode.toLowerCase());
        if (btn) {
          btn.click();
          return { success: true, mode };
        }
        return { success: false };
      }, targetMode);
    } catch {
      return { success: false };
    }
  }

  /**
   * Mengirim prompt teks ke Google Gemini
   */
  async sendMessage(promptText, options = {}) {
    const page = await this.getPage();
    await page.bringToFront();

    // 0. Pre-Send Rate Limit Check (abaikan badge Flash-Lite sementara karena selectModel akan mencoba switch ke Argon)
    if (await this.detectRateLimit({ checkBadge: false })) {
      return { success: false, rateLimited: true, reason: 'rate_limited_before_send' };
    }

    // 1. Verifikasi kesiapan halaman
    const isReady = await this.waitForReady(15000);
    if (!isReady) {
      throw new Error('[GEMINI] Halaman belum siap atau input box tidak ditemukan.');
    }

    // 2. Pastikan model terpilih sesuai konfigurasi (default: 4 Argon)
    const targetModel = options.model || this.config.default_model || '4 Argon';
    const modelRes = await this.selectModel(targetModel);
    if (modelRes.rateLimited) {
      return { success: false, rateLimited: true, reason: modelRes.reason, resetText: modelRes.resetText };
    }

    // 3. Pastikan tingkat penalaran (default: Tinggi jika 4 Argon)
    if (targetModel.toLowerCase().includes('argon')) {
      const reasoningLevel = options.reasoning || this.config.default_reasoning || 'Tinggi';
      await this.setReasoningLevel(reasoningLevel);
    }

    // 4. Pastikan mode ("Percakapan" vs "Tugas")
    if (options.mode) {
      await this.selectMode(options.mode);
    }

    // 5. Catat jumlah pesan awal untuk turn snapshot
    this.initialCount = await this.getMessageCount();

    // 6. Masukkan teks prompt ke dalam editor Quill (.ql-editor)
    const editor = await page.$('.ql-editor');
    if (!editor) throw new Error('[GEMINI] .ql-editor tidak ditemukan di DOM!');

    await editor.click();
    await new Promise(r => setTimeout(r, 300));

    // Bersihkan draft lama dan fokus editor
    await page.evaluate(() => {
      const el = document.querySelector('.ql-editor');
      if (el) {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      }
    });

    // Masukkan teks via CDP Input.insertText agar baris baru dan prompt panjang tidak terpotong oleh Quill
    const client = await page.createCDPSession();
    await client.send('Input.insertText', { text: promptText });
    await client.detach();

    await new Promise(r => setTimeout(r, 500));

    // Ketik spasi pemicu agar Angular merender tombol 'Kirim pesan'
    let sendBtn = await this.findSendButton(page);
    if (!sendBtn) {
      await page.keyboard.type(' ');
      await new Promise(r => setTimeout(r, 500));
      sendBtn = await this.findSendButton(page);
    }

    if (!sendBtn) {
      throw new Error('[GEMINI] Tombol Kirim pesan tidak ditemukan atau tidak aktif setelah pengetikan.');
    }

    // Klik tombol Kirim via native click
    await sendBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // Post-send check: jika input belum kosong, tekan Enter terarah
    const stillHasText = await page.evaluate(() => {
      const el = document.querySelector('.ql-editor');
      return el && (el.innerText || '').trim().length > 0;
    });

    if (stillHasText) {
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 600));
    }

    return { success: true, rateLimited: false };
  }

  async findSendButton(page) {
    const selectors = this.config.send_button_selectors || [
      'button[aria-label="Kirim pesan"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Kirim"]',
      'button[aria-label*="Send"]'
    ];

    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        const isVisible = await page.evaluate(el => {
          return !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.offsetWidth > 0 && el.offsetHeight > 0;
        }, btn);
        if (isVisible) return btn;
      }
    }
    return null;
  }

  /**
   * Menunggu respons dari Gemini dengan telemetri Long Thinking Silence (Argon)
   */
  async waitForResponse(timeoutMs = 240000) {
    const page = await this.getPage();
    const startTime = Date.now();
    let streamObserved = false;
    let lastLength = -1;
    let stableSince = Date.now();
    const stabilityThresholdMs = 3500;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000));

      // 1. Cek rate limit / toast error secara periodik
      if (await this.detectRateLimit()) {
        const partialText = await this.extractResponse().catch(() => '');
        return { success: false, rateLimited: true, text: partialText };
      }

      // 2. Evaluasi status streaming & turn count
      const state = await page.evaluate((stopSelectors, msgSelectors) => {
        let hasStop = false;
        for (const sel of stopSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
            hasStop = true;
            break;
          }
        }

        let totalTurns = 0;
        let lastRespText = '';
        for (const sel of msgSelectors) {
          const nodes = document.querySelectorAll(sel);
          if (nodes.length > totalTurns) totalTurns = nodes.length;
          if (nodes.length > 0) {
            lastRespText = (nodes[nodes.length - 1].innerText || '').trim();
          }
        }

        return {
          hasStopButton: hasStop,
          turnCount: totalTurns,
          lastResponseLength: lastRespText.length
        };
      }, this.config.stop_button_selectors || ['button[aria-label*="Hentikan"]'], this.config.message_selectors || ['model-response']);

      // Jika tombol stop aktif, berarti model sedang berpikir (Long Thinking Silence) atau sedang streaming teks
      if (state.hasStopButton) {
        streamObserved = true;
        stableSince = Date.now();
        continue;
      }

      // Jika tombol stop sudah tidak ada
      const turnIncremented = state.turnCount > this.initialCount;
      if (turnIncremented && state.lastResponseLength > 0) {
        if (state.lastResponseLength !== lastLength) {
          lastLength = state.lastResponseLength;
          stableSince = Date.now();
        } else {
          // Teks telah stabil tanpa perubahan selama rentang waktu stabilitas
          if (Date.now() - stableSince >= stabilityThresholdMs) {
            const text = await this.extractResponse();
            return { success: true, rateLimited: false, text };
          }
        }
      } else if (streamObserved && !state.hasStopButton) {
        // Stop button pernah aktif lalu hilang, tunggu sebentar untuk kestabilan DOM
        if (Date.now() - stableSince >= stabilityThresholdMs) {
          const text = await this.extractResponse();
          return { success: true, rateLimited: false, text };
        }
      }
    }

    throw new Error(`[TIMEOUT] Google Gemini tidak menyelesaikan respons dalam batas waktu ${timeoutMs / 1000} detik.`);
  }

  /**
   * Ekstraksi respons dengan preservasi formula KaTeX non-destruktif
   * dan pembersihan tombol aksi/elemen sampah.
   */
  async extractResponse() {
    const page = await this.getPage();
    return await page.evaluate((msgSelectors) => {
      let targetEl = null;
      for (const sel of msgSelectors) {
        const msgs = document.querySelectorAll(sel);
        if (msgs.length > 0) {
          targetEl = msgs[msgs.length - 1];
          break;
        }
      }
      if (!targetEl) return '';

      // Abaikan elemen tombol aksi, audio player, dan footer di dalam model-response
      const ignoredNodes = Array.from(targetEl.querySelectorAll(
        'button, .response-footer, .message-actions, mat-icon, .play-button, .sr-only, model-thoughts'
      ));
      const originalDisplays = [];
      ignoredNodes.forEach((n) => {
        originalDisplays.push({ node: n, display: n.style.display });
        n.style.display = 'none';
      });

      // Helper TeX extraction
      function getTexFromNode(node) {
        const annotation = node.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"]');
        if (annotation && annotation.textContent.trim()) {
          return annotation.textContent.trim();
        }
        const dataMath = node.getAttribute('data-math');
        if (dataMath && dataMath.trim()) {
          return dataMath.trim();
        }
        return null;
      }

      const allMathNodes = Array.from(targetEl.querySelectorAll('.katex-display, .math-display, .katex, .math-inline'));
      const topMathNodes = allMathNodes.filter(node => {
        let parent = node.parentElement;
        while (parent && parent !== targetEl) {
          if (allMathNodes.includes(parent)) return false;
          parent = parent.parentElement;
        }
        return true;
      });

      if (topMathNodes.length === 0) {
        const text = (targetEl.innerText || '').trim();
        originalDisplays.forEach(item => { item.node.style.display = item.display; });
        return text;
      }

      // Penggantian in-place sementara
      const originalNodes = [];
      topMathNodes.forEach((node) => {
        const tex = getTexFromNode(node);
        if (tex) {
          const isDisplay = node.classList.contains('katex-display') ||
                            node.classList.contains('math-display') ||
                            node.tagName.toLowerCase() === 'div';
          const textNode = document.createTextNode(isDisplay ? `\n$$\n${tex}\n$$\n` : ` $${tex}$ `);
          const parent = node.parentNode;
          if (parent) {
            parent.replaceChild(textNode, node);
            originalNodes.push({ parent, node, textNode });
          }
        }
      });

      const extractedText = (targetEl.innerText || '').trim();

      // Restorasi seketika tanpa efek samping
      for (const item of originalNodes) {
        if (item.parent && item.textNode) {
          item.parent.replaceChild(item.node, item.textNode);
        }
      }
      originalDisplays.forEach(item => { item.node.style.display = item.display; });

      return extractedText;
    }, this.config.message_selectors || ['model-response']);
  }

  /**
   * Reset sesi percakapan Gemini ke obrolan bersih baru
   */
  async resetSession() {
    const page = await this.getPage();
    const selectors = this.config.new_chat_selectors || [
      '[data-test-id="side-nav-sparkle-button"]',
      'a[aria-label*="Chat baru"]',
      'a[aria-label*="Percakapan baru"]',
      '[data-test-id="new-chat-button"]',
      'button[aria-label*="Percakapan baru"]'
    ];
    
    try {
      let clicked = false;
      for (const sel of selectors) {
        const btn = await page.$(sel);
        if (btn) {
          const isUsable = await page.evaluate(el => el.offsetWidth > 0 || el.getClientRects().length > 0, btn);
          if (isUsable) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1500));
            clicked = true;
            break;
          }
        }
      }
      if (!clicked) {
        await page.goto(this.config.home_url || 'https://gemini.google.com/app?hl=id', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000));
      }
      this.initialCount = 0;
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = GeminiDriver;
