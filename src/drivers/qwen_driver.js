/**
 * QwenDriver
 * Driver browser untuk chat.qwen.ai (Qwen Reasoning / Thinking Model)
 */

const BaseDriver = require('./base_driver');

class QwenDriver extends BaseDriver {
  constructor(browserManager, providerConfig) {
    super(browserManager, providerConfig);
    this.providerName = 'qwen';
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

  async getMessageCount() {
    try {
      const page = await this.getPage();
      return await page.evaluate(() => {
        return document.querySelectorAll('.qwen-chat-message-assistant').length;
      });
    } catch {
      return 0;
    }
  }

  async detectRateLimit() {
    try {
      const page = await this.getPage();
      const result = await page.evaluate((patterns) => {
        const alerts = Array.from(document.querySelectorAll('[role="alert"], div[class*="toast"], div[class*="modal"], div[class*="error"], div[class~="banner"]'));
        for (const alertEl of alerts) {
          // Abaikan jika alert berada di dalam pesan chat atau di dalam input box
          if (alertEl.closest('.message-content, [data-role="assistant"], .chat-message-assistant, form, textarea, .chat-input, [contenteditable="true"]')) continue;
          if (alertEl.querySelector('form, textarea, .chat-input, [contenteditable="true"]')) continue;

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
   * Memastikan model tertentu dipilih di UI Qwen (default: Qwen3.8-Max)
   */
  async selectModel(targetModelName = 'Qwen3.8-Max') {
    try {
      const page = await this.getPage();
      const currentModel = await page.evaluate(() => {
        const el = document.querySelector('.wms-trigger__text, .wms-trigger');
        return el ? el.innerText.trim() : null;
      });

      if (currentModel && currentModel.toLowerCase().includes(targetModelName.toLowerCase())) {
        return { success: true, model: currentModel, changed: false };
      }

      // Buka dropdown jika belum terbuka
      const isMenuOpen = await page.evaluate(() => {
        const trigger = document.querySelector('.wms-trigger');
        return trigger && trigger.classList.contains('wms-trigger--open');
      });

      if (!isMenuOpen) {
        await page.click('.wms-trigger');
        await new Promise(r => setTimeout(r, 800));
      }

      // Klik pilihan model target
      const clicked = await page.evaluate((targetName) => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const t = (el.innerText || '').trim();
          return t.toLowerCase().includes(targetName.toLowerCase()) && el.children.length === 0;
        });

        if (elements.length > 0) {
          const item = elements[0].closest('[role="option"], [class*="item"], div') || elements[0];
          item.click();
          return true;
        }
        return false;
      }, targetModelName);

      await new Promise(r => setTimeout(r, 1000));

      const updatedModel = await page.evaluate(() => {
        const el = document.querySelector('.wms-trigger__text, .wms-trigger');
        return el ? el.innerText.trim() : null;
      });

      return { success: clicked, model: updatedModel || targetModelName, changed: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Mengatur mode penalaran di Qwen ('Berpikir' | 'Otomatis' | 'Cepat')
   */
  async setReasoningMode(mode = 'Berpikir') {
    try {
      const page = await this.getPage();
      const current = await page.evaluate(() => {
        const el = document.querySelector('.qwen-thinking-selector, .qwen-chat-v2-dropdown-menu-select');
        return el ? el.innerText.trim() : null;
      });

      if (current && current.toLowerCase().includes(mode.toLowerCase())) {
        return { success: true, mode: current, changed: false };
      }

      // Buka dropdown penalaran jika belum terbuka
      const isMenuOpen = await page.evaluate(() => {
        return document.querySelectorAll('.qwen-chat-v2-dropdown-menu-item').length > 0;
      });

      if (!isMenuOpen) {
        await page.click('.qwen-thinking-selector, .qwen-chat-v2-dropdown-menu-select');
        await new Promise(r => setTimeout(r, 600));
      }

      const clicked = await page.evaluate((targetMode) => {
        const items = Array.from(document.querySelectorAll('.qwen-chat-v2-dropdown-menu-item, .qwen-chat-v2-dropdown-menu-item-label'));
        const target = items.find(el => (el.innerText || '').trim().toLowerCase() === targetMode.toLowerCase());
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, mode);

      await new Promise(r => setTimeout(r, 600));
      return { success: clicked, mode, changed: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendMessage(promptText) {
    this._retryAttempted = false;
    const page = await this.getPage();
    const ready = await this.waitForReady(15000);
    if (!ready) {
      throw new Error('Halaman Qwen belum siap atau input box tidak ditemukan. Pastikan sudah login di chat.qwen.ai');
    }

    // 0. Pre-Check: Cek segera apakah Qwen saat ini sudah dalam kondisi batas kuota (Rate Limit)
    const immediateLimit = await this.detectRateLimit();
    if (immediateLimit) {
      return { sent: false, rateLimited: true };
    }

    // Pastikan model default (Qwen3.8-Max) terpilih jika belum
    const preferredModel = this.config.default_model || 'Qwen3.8-Max';
    await this.selectModel(preferredModel);

    // Pastikan mode penalaran "Berpikir" aktif
    const preferredReasoning = this.config.default_reasoning || 'Berpikir';
    await this.setReasoningMode(preferredReasoning);

    // Catat baseline jumlah pesan sebelum mengirim
    this.initialCount = await this.getMessageCount();

    // 1. Fokus dan isi teks input
    await page.evaluate((inputSelectors, text) => {
      let inputEl = null;
      for (const sel of inputSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null && !el.disabled) {
          inputEl = el;
          break;
        }
      }
      if (!inputEl) throw new Error('Input Qwen tidak ditemukan');

      inputEl.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, this.config.input_selectors, promptText);

    await new Promise(r => setTimeout(r, 600));

    // Cek limit segera
    const limitedImmediate = await this.detectRateLimit();
    if (limitedImmediate) {
      return { sent: false, rateLimited: true };
    }

    // 2. Klik tombol Kirim (Send) jika ada
    await page.evaluate((sendSelectors) => {
      for (const sel of sendSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }
    }, this.config.send_button_selectors);

    // Pastikan terkirim via penekanan tombol Enter pada textarea
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 1200));
    const limitedAfterSend = await this.detectRateLimit();
    return { sent: true, rateLimited: limitedAfterSend };
  }

  /**
   * Tunggu jawaban Qwen.
   * Default timeout 420.000 ms (7 menit) khusus untuk mode Deep Reasoning / Thinking.
   */
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

      const state = await page.evaluate((stopSelectors, streamSelectors, initialCount) => {
        let isGenerating = false;
        let isThinking = false;
        let answerText = '';

        // 1. Cek stop button
        for (const sel of stopSelectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            isGenerating = true;
            break;
          }
        }

        // 2. Cek streaming / awaiting response indicator
        for (const sel of streamSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) {
            isGenerating = true;
            break;
          }
        }

        // 3. Cek pesan asisten terakhir HANYA bila ada pesan baru dibanding initialCount
        const asstMessages = Array.from(document.querySelectorAll('.qwen-chat-message-assistant'));
        let hasFooterActions = false;

        if (asstMessages.length > initialCount) {
          const lastAsst = asstMessages[asstMessages.length - 1];

          // Auto-pilih kartu respon jika muncul dialog komparasi RLHF (dual-message / smrm)
          const smrm = lastAsst.querySelector('.smrm');
          if (smrm) {
            const preferBtns = Array.from(smrm.querySelectorAll('.smrm-card__prefer-btn'));
            if (preferBtns.length > 0) {
              // Klik respons terbaik
              preferBtns[preferBtns.length - 1].click();
            } else {
              isGenerating = true;
            }
          }

          // Cek status thinking card pada pesan terakhir
          const thinkingCard = lastAsst.querySelector('.qwen-chat-thinking-status-card, .qwen-chat-thinking-tool-status-card-wraper, [class*="thinking"]');
          if (thinkingCard) {
            const cardText = (thinkingCard.innerText || '').toLowerCase();
            const thinkingFinished = cardText.includes('selesai') || cardText.includes('completed') || cardText.includes('done');
            if (!thinkingFinished) {
              isThinking = true;
              isGenerating = true;
            }
          }

          // Ambil teks jawaban HANYA dari container konten respons (BUKAN thinking card)
          const answerContent = lastAsst.querySelector('.response-message-content, .custom-qwen-markdown');
          if (answerContent) {
            answerText = answerContent.innerText || '';
          } else {
            // Jika thinking sudah selesai tapi content div belum ada, berarti masih mulai generate teks
            if (!isThinking && thinkingCard) {
              isGenerating = true;
            }
          }

          hasFooterActions = !!lastAsst.querySelector('.qwen-chat-package-comp-new-action-control-container, .copy-response-button');
        }

        return {
          isGenerating,
          isThinking,
          hasFooterActions,
          text: answerText
        };
      }, this.config.stop_button_selectors, this.config.streaming_selectors, this.initialCount);

      if (state.isGenerating || state.isThinking || currentCount > this.initialCount || (state.text.length > 0 && hasStarted)) {
        hasStarted = true;
      }

      // Jika 15 detik belum merespons, cek limit
      if (!hasStarted && Date.now() - startTime > 15000) {
        const limitCheck = await this.detectRateLimit();
        if (limitCheck) return { success: false, rateLimited: true, text: '' };
      }

      // Jawaban dianggap selesai jika:
      // - Sudah mulai (hasStarted)
      // - Tidak ada stop button / generating (!state.isGenerating)
      // - Berpikir sudah tuntas (!state.isThinking)
      // - Teks jawaban sudah ada dan tidak kosong
      // - Entah tombol aksi footer sudah muncul (instan) atau teks stabil minimal 2 detik
      if (hasStarted && !state.isGenerating && !state.isThinking && state.text.trim().length > 0) {
        if (state.hasFooterActions || (state.text === lastText && ++stableCount >= 2)) {
          const finalText = await this.extractResponse();
          const cleanText = (finalText || state.text).trim();

          // Auto-Retry jika muncul error lonjakan permintaan / transient connection issue
          const isTransientError = cleanText.toLowerCase().includes('issue connecting') || 
                                   cleanText.toLowerCase().includes('lonjakan permintaan') ||
                                   cleanText.toLowerCase().includes('terhubung kembali');
          if (isTransientError && !this._retryAttempted) {
            this._retryAttempted = true;
            const clicked = await page.evaluate(() => {
              const regenBtn = document.querySelector('.qwen-chat-package-comp-new-action-control-container-regenerate, button[aria-label*="Buat Ulang"], button[aria-label*="Regenerate"]');
              if (regenBtn) {
                regenBtn.click();
                return true;
              }
              return false;
            });
            if (clicked) {
              hasStarted = false;
              stableCount = 0;
              lastText = '';
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
          }

          return { success: true, rateLimited: false, text: cleanText };
        }
        if (state.text !== lastText) {
          stableCount = 0;
          lastText = state.text;
        }
      } else if (hasStarted) {
        lastText = state.text;
      }
    }

    if (hasStarted && lastText && lastText.trim().length > 0) {
      const finalText = await this.extractResponse();
      return { success: true, rateLimited: false, text: (finalText || lastText).trim() };
    }

    throw new Error('Batas waktu (timeout) 7 menit tercapai saat menunggu jawaban dari Qwen Thinking Mode');
  }

  /**
   * Ekstrak teks respons Qwen dengan mengabaikan kartu reasoning (Thinking Card)
   * dan merestorasi KaTeX secara non-destruktif dengan layout asli.
   */
  async extractResponse() {
    const page = await this.getPage();
    return await page.evaluate(() => {
      const asstMessages = Array.from(document.querySelectorAll('.qwen-chat-message-assistant'));
      if (asstMessages.length === 0) return '';
      const lastAsst = asstMessages[asstMessages.length - 1];

      // Ambil elemen konten jawaban khusus Qwen
      const targetEl = lastAsst.querySelector('.response-message-content, .custom-qwen-markdown') || lastAsst;

      // Helper untuk mengambil TeX dari berbagai varian KaTeX / MathML / MathJax
      function getTexFromNode(node) {
        // 1. Coba standard KaTeX annotation
        const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation && annotation.textContent.trim()) {
          return annotation.textContent.trim();
        }

        // 2. Coba MathML math element (khusus Qwen custom KaTeX renderer)
        const mathEl = node.tagName.toLowerCase() === 'math' ? node : node.querySelector('math');
        if (mathEl) {
          let directText = '';
          Array.from(mathEl.childNodes).forEach(c => {
            if (c.nodeType === Node.TEXT_NODE) {
              directText += c.textContent;
            }
          });
          if (directText.trim()) {
            return directText.trim();
          }
        }

        // 3. Fallback MathJax
        const mathjax = node.querySelector('script[type="math/tex"]');
        if (mathjax && mathjax.textContent.trim()) {
          return mathjax.textContent.trim();
        }

        return null;
      }

      const allMathNodes = Array.from(targetEl.querySelectorAll('.qwen-markdown-latex, .katex-display, .katex, script[type="math/tex"], mjx-container'));
      const topMathNodes = allMathNodes.filter(node => {
        let parent = node.parentElement;
        while (parent && parent !== targetEl) {
          if (allMathNodes.includes(parent)) return false;
          parent = parent.parentElement;
        }
        return true;
      });

      if (topMathNodes.length === 0) {
        return (targetEl.innerText || '').trim();
      }

      const originalNodes = [];
      topMathNodes.forEach((node) => {
        const tex = getTexFromNode(node);
        if (tex) {
          const isDisplay = node.classList.contains('katex-display') ||
                            node.tagName.toLowerCase() === 'div' ||
                            !!node.querySelector('.katex-display') ||
                            !!node.closest('.katex-display');
          const textNode = document.createTextNode(isDisplay ? `\n$$\n${tex}\n$$\n` : ` $${tex}$ `);
          const parent = node.parentNode;
          if (parent) {
            parent.replaceChild(textNode, node);
            originalNodes.push({ parent, node, textNode });
          }
        }
      });

      const extractedText = (targetEl.innerText || '').trim();

      for (const item of originalNodes) {
        if (item.parent && item.textNode) {
          item.parent.replaceChild(item.node, item.textNode);
        }
      }

      return extractedText;
    });
  }
}

module.exports = QwenDriver;
