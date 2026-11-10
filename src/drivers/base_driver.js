/**
 * BaseDriver
 * Kontrak dasar untuk seluruh driver automasi browser web LLM.
 */

class BaseDriver {
  constructor(browserManager, providerConfig) {
    this.browserManager = browserManager;
    this.config = providerConfig;
    this.providerName = 'base';
    this.initialCount = 0;
  }

  async getPage() {
    return await this.browserManager.getTab(this.providerName);
  }

  /**
   * Cek apakah halaman siap menerima input chat (sudah login)
   */
  async isReady() {
    throw new Error('isReady() must be implemented by driver');
  }

  /**
   * Menunggu halaman siap menerima input dengan timeout
   */
  async waitForReady(timeoutMs = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) return true;
      const auth = await this.detectAuthRequired();
      if (auth.authRequired) {
        throw new Error(`[AUTH_REQUIRED] ${this.providerName.toUpperCase()} memerlukan login di browser (${auth.reason}).`);
      }
      await new Promise(r => setTimeout(r, 800));
    }
    return false;
  }

  /**
   * Hitung jumlah elemen pesan asisten di DOM saat ini (untuk deteksi pesan baru)
   */
  async getMessageCount() {
    try {
      const page = await this.getPage();
      return await page.evaluate((selectors) => {
        let count = 0;
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > count) count = els.length;
        }
        return count;
      }, this.config.message_selectors);
    } catch {
      return 0;
    }
  }

  /**
   * Deteksi apakah halaman memerlukan autentikasi manual / Cloudflare Challenge
   */
  async detectAuthRequired() {
    try {
      const page = await this.getPage();
      const currentUrl = page.url().toLowerCase();

      // 1. Cek URL redirect login
      if (this.config.auth_urls && Array.isArray(this.config.auth_urls)) {
        for (const authUrl of this.config.auth_urls) {
          if (currentUrl.includes(authUrl.toLowerCase())) {
            return {
              authRequired: true,
              reason: `Halaman dialihkan ke rute autentikasi (${currentUrl})`
            };
          }
        }
      }

      // 2. Cek teks pola login / challenge di DOM
      if (this.config.auth_patterns && Array.isArray(this.config.auth_patterns)) {
        const result = await page.evaluate((patterns) => {
          const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
          const title = document.title ? document.title.toLowerCase() : '';
          for (const p of patterns) {
            const lowerP = p.toLowerCase();
            if (bodyText.includes(lowerP) || title.includes(lowerP)) {
              return { authRequired: true, pattern: p };
            }
          }
          return { authRequired: false };
        }, this.config.auth_patterns);

        if (result.authRequired) {
          return {
            authRequired: true,
            reason: `Terdeteksi dialog login/verifikasi: "${result.pattern}"`
          };
        }
      }

      return { authRequired: false };
    } catch {
      return { authRequired: false };
    }
  }

  /**
   * Ketikkan teks dan kirimkan prompt
   */
  async sendMessage(promptText) {
    throw new Error('sendMessage() must be implemented by driver');
  }

  /**
   * Tunggu sampai model selesai menghasilkan jawaban
   */
  async waitForResponse(timeoutMs = 180000) {
    throw new Error('waitForResponse() must be implemented by driver');
  }

  /**
   * Periksa apakah muncul banner/peringatan batas kuota
   */
  async detectRateLimit() {
    throw new Error('detectRateLimit() must be implemented by driver');
  }

  /**
   * Ekstrak jawaban teks terakhir secara non-destruktif
   * dengan memulihkan formula LaTeX dari tag annotation KaTeX/MathJax
   * langsung pada live DOM yang direstorasi seketika untuk menjaga layout asli.
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

      // Abaikan elemen thinking, header screen-reader (sr-only), dan kartu footer/RLHF jika ada di dalam targetEl
      const ignoredNodes = Array.from(targetEl.querySelectorAll(
        '.qwen-chat-thinking-tool-status-card-wraper, .qwen-chat-thinking-status-card, [class*="thinking"], ' +
        '.sr-only, h4[data-conversation-role="assistant"], [data-chatgpt-agent-turn-start], ' +
        '.smrm, .qwen-chat-message-footer, [class*="footer"]'
      ));
      const originalDisplays = [];
      ignoredNodes.forEach((n) => {
        originalDisplays.push({ node: n, display: n.style.display });
        n.style.display = 'none';
      });

      // Helper untuk mengambil TeX dari berbagai varian KaTeX / MathML / MathJax
      function getTexFromNode(node) {
        // 1. Coba standard KaTeX annotation
        const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation && annotation.textContent.trim()) {
          return annotation.textContent.trim();
        }

        // 2. Coba MathML math element (khusus Qwen custom KaTeX renderer tanpa tag annotation)
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

      // Identifikasi target: gantikan wrapper qwen-markdown-latex, katex-display, katex, atau MathJax
      const allMathNodes = Array.from(targetEl.querySelectorAll('.qwen-markdown-latex, .katex-display, .katex, script[type="math/tex"], mjx-container'));
      // Filter hanya node terluar per formula agar tidak terjadi pemrosesan ganda
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

      // Restorasi seketika tanpa efek samping pada DOM aktif
      for (const item of originalNodes) {
        if (item.parent && item.textNode) {
          item.parent.replaceChild(item.node, item.textNode);
        }
      }
      originalDisplays.forEach(item => { item.node.style.display = item.display; });

      return extractedText;
    }, this.config.message_selectors);
  }
}

module.exports = BaseDriver;
