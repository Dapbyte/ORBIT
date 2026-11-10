/**
 * Orchestrator Core (v1.3 Resilient Multi-Provider)
 * Mengatur eksekusi tugas ke Claude dengan failover sekuensial ke Qwen dan ChatGPT,
 * mendukung injeksi file langsung (files: []), cross-process mutex lock, cooldown tracking,
 * privacy guard, dan pencatatan metrik eksekusi executions.jsonl.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BrowserManager } = require('./browser_manager');
const ClaudeDriver = require('./drivers/claude_driver');
const QwenDriver = require('./drivers/qwen_driver');
const ChatGPTDriver = require('./drivers/chatgpt_driver');
const GeminiDriver = require('./drivers/gemini_driver');
const SessionHistory = require('./session_history');
const LockManager = require('./lock_manager');
const { sealTail, buildLedger, buildPrompt, stitch } = require('./stream_recovery');
const { normalizeMath } = require('./math_normalizer');
const PromptSynthesizer = require('./prompt_synthesizer');
const CriticEngine = require('./critic_engine');
const { parseResetText } = require('./parse_reset');
const { CooldownStore } = require('./cooldown_store');

const SELECTORS_FILE = path.join(__dirname, '..', 'selectors.json');
const GLOBAL_DATA_DIR = path.join(os.homedir(), '.web-llm-orchestrator');
const EXECUTIONS_LOG_FILE = path.join(GLOBAL_DATA_DIR, 'executions.jsonl');

// Daftar pola file terlarang demi privasi
const FORBIDDEN_FILE_PATTERNS = [
  /\.env(\..+)?$/i,
  /\.key$/i,
  /\.pem$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.ppk$/i,
  /\.kdbx$/i,
  /\.npmrc$/i,
  /\.netrc$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /credentials/i,
  /\.git[\/\\]/i,
  /\.aws[\/\\]/i,
  /\.ssh[\/\\]/i,
  /secrets\./i
];

const ENGINEERING_CAVEMAN_CONTRACT = 
`[ATURAN KELUARAN — ENGINEERING CAVEMAN GENERATE]
1. Bernalar penuh secara internal. Aturan ini HANYA mengatur penulisan hasil akhir.
2. POLA JAWABAN (Answer-First):
   - Baris pertama: [THING] [ACTION] [REASON] (maksimal 10 kata).
     ACTION: ANSWER | ANALYZE | AUDIT | DERIVE | IMPLEMENT | FIX | CONTINUE | REFUSE.
     WAJIB gunakan tanda kurung siku [...] untuk setiap elemen (contoh: [OPTIMIZATION] [DERIVE] [HESSIAN POSITIVE SEMIDEFINITE]).
     (Jika prompt pengguna secara eksplisit meminta format khusus seperti JSON murni, tabel, atau teks naskah langsung, utamakan format permintaan pengguna).
   - Setelah itu, langsung berikan artefak teknis utama: solusi, kode, derivasi matematika, atau analisis.
3. ZERO CEREMONY (Dilarang):
   - Tanpa sapaan ("Halo"), pujian, pengantar ("Tentu", "Berikut", "Pada dasarnya", "Secara umum"), penutup ("Semoga membantu"), atau permohonan maaf.
   - Tanpa pengulangan prompt atau meta-komentar ("Saya akan menganalisis...").
4. FLOOR NON-NEGOTIABLE (Haram Disingkat/Dipotong):
   - Kode sumber, derivasi matematika LaTeX utuh, angka presisi, satuan, operator, nama variabel/identifier, path file, kutipan error, dan kata logika ingkar ("tidak", "bukan", "hanya", "kecuali").
   - Kompresi hanya berlaku untuk narasi dan prosa pengiring.
5. STANDAR MATEMATIKA:
   - Derivasi/bukti ditulis lengkap tanpa melompati tahap kritis.
   - Gunakan delimiter canonical: $...$ untuk inline math, serta $$...$$ atau blok \`\`\`latex untuk display math/derivasi panjang.
6. PROTOKOL KRITIS & BLOCKER:
   - Jangan mengarang referensi, angka, atau hasil. Bantah premis yang keliru. Jika ada fakta hilang/blocker fatal, tulis "BLOCKER: <fakta hilang>" lalu berhenti.
   - Jangan memaksakan mencari kelemahan jika kode/teks sudah benar (tulis "tidak ada masalah material").
--------------------------------------------------\n`;

const HANDOFF_CAVEMAN_FALLBACK_CONTRACT = 
`[ATURAN KELUARAN — HANDOFF CAVEMAN CONTINUATION]
1. Anda melanjutkan tugas yang terputus dari sesi sebelumnya. Output HANYA lanjutan murni.
2. DILARANG memakai pola [THING] [ACTION] [REASON] atau menulis baris ringkasan di awal.
3. ZERO PREAMBLE: Dilarang menulis kata pengantar, sapaan, atau meta-komentar ("Berikut kelanjutan...", "Melanjutkan", "Tentu", "Continuing").
4. Mulai LANGSUNG dari teks atau section kelanjutan tanpa mengulang apa yang sudah ada.
5. FLOOR: Pertahankan kedalaman penuh. Jangan meringkas atau memotong kode dan derivasi matematika.
6. Format matematika: gunakan $...$ untuk inline dan $$...$$ atau \`\`\`latex untuk display.
--------------------------------------------------\n`;

class Orchestrator {
  constructor(selectorsPath = SELECTORS_FILE) {
    const rawSelectors = fs.readFileSync(selectorsPath, 'utf-8');
    this.selectors = JSON.parse(rawSelectors);

    this.browserManager = new BrowserManager(this.selectors);
    this.claudeDriver = new ClaudeDriver(this.browserManager, this.selectors.claude);
    this.qwenDriver = new QwenDriver(this.browserManager, this.selectors.qwen);
    this.chatgptDriver = new ChatGPTDriver(this.browserManager, this.selectors.chatgpt);
    this.geminiDriver = new GeminiDriver(this.browserManager, this.selectors.gemini);

    this.drivers = {
      claude: this.claudeDriver,
      gemini: this.geminiDriver,
      qwen: this.qwenDriver,
      chatgpt: this.chatgptDriver
    };

    this.sessionHistory = new SessionHistory();
    this.lockManager = new LockManager();
    this.promptSynthesizer = new PromptSynthesizer();
    this.criticEngine = new CriticEngine();
    this.interrogationEngine = this.criticEngine; // Aliased for full backward compatibility

    // Cooldown tracker per provider (in-memory cache & persistent cross-process lease store)
    this.cooldownStore = new CooldownStore();
    this.cooldowns = {
      claude: 0,
      gemini: 0,
      qwen: 0,
      chatgpt: 0
    };
  }

  async getStatus() {
    return await this.browserManager.getStatus();
  }

  async resetSession(onLog = () => {}, targetProvider = null) {
    this.sessionHistory.clear();
    if (targetProvider) {
      this.cooldowns[targetProvider] = 0;
      this.cooldownStore.clear(targetProvider);
    } else {
      this.cooldowns = { claude: 0, gemini: 0, qwen: 0, chatgpt: 0 };
      this.cooldownStore.clearAll();
    }
    await this.browserManager.resetTabs(onLog, targetProvider);
    const scopeMsg = targetProvider ? `tab browser ${targetProvider}` : 'seluruh tab browser (Claude, Gemini, Qwen, ChatGPT)';
    return { success: true, message: `Riwayat sesi obrolan lokal telah dibersihkan dan ${scopeMsg} telah dialihkan ke obrolan baru.` };
  }

  async close() {
    await this.browserManager.disconnect();
  }

  resolveFiles(filePaths = []) {
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return '';
    }

    const workspaceRoot = process.cwd();
    let bundle = '\n\n--- LAMPIRAN FILE PROYEK ---\n';

    for (const rawPath of filePaths) {
      const isAbs = path.isAbsolute(rawPath);
      const resolved = isAbs ? path.normalize(rawPath) : path.resolve(workspaceRoot, rawPath);

      // Boundary check anti-traversal untuk path relatif
      if (!isAbs && !resolved.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
        throw new Error(`[PATH_TRAVERSAL_VIOLATION] Akses ke luar direktori kerja ditolak: ${rawPath}`);
      }

      const normalized = resolved.replace(/\\/g, '/');
      for (const pattern of FORBIDDEN_FILE_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(resolved)) {
          throw new Error(`[PRIVACY GUARD] Akses ke file sensitif ditolak: ${rawPath}`);
        }
      }

      if (!fs.existsSync(resolved)) {
        throw new Error(`File lampiran tidak ditemukan: ${rawPath}`);
      }

      const content = fs.readFileSync(resolved, 'utf-8');
      bundle += `\n[FILE: ${normalized}]\n\`\`\`\n${content}\n\`\`\`\n`;
    }

    bundle += '----------------------------\n';
    return bundle;
  }

  logExecution(entry) {
    try {
      if (!fs.existsSync(GLOBAL_DATA_DIR)) {
        fs.mkdirSync(GLOBAL_DATA_DIR, { recursive: true });
      }
      const record = {
        timestamp: new Date().toISOString(),
        ...entry
      };
      fs.appendFileSync(EXECUTIONS_LOG_FILE, JSON.stringify(record) + '\n', 'utf-8');
    } catch (err) {
      // Logging non-blocking
    }
  }

  /**
   * Pemulihan status sesi terpotong via stream_recovery (v1.5)
   * Memotong tail kotor, menyusun ledger, dan membungkus re-hydration prompt dengan nonce box.
   */
  recoverSessionHandoff({ previousProvider, candidateProvider, partialText, taskPrompt, originalFullPrompt }) {
    if (partialText && typeof partialText === 'string' && partialText.trim().length >= 100) {
      const rateLimitPatterns = (this.selectors[previousProvider] && this.selectors[previousProvider].rate_limit_patterns) || [];
      const sealedRes = sealTail(partialText, rateLimitPatterns);
      if (sealedRes.sealed && sealedRes.sealed.length >= 80) {
        const ledger = buildLedger(sealedRes.sealed);
        const targetTokens = candidateProvider === 'qwen' ? 16000 : 8000;
        const handoffState = {
          task: {
            originalPrompt: taskPrompt || originalFullPrompt,
            constraintsHard: [
              'Lanjutkan langsung dari section berikutnya tanpa basa-basi pembuka',
              'Pertahankan konvensi notasi dan format yang sudah ada di dokumen'
            ]
          },
          decisions: [{ text: `Melanjutkan tugas yang terputus dari ${previousProvider}`, source: previousProvider }],
          sealed: sealedRes.sealed,
          ledger
        };
        try {
          const handoff = buildPrompt(handoffState, { ctxTokens: targetTokens, replyReserve: 2000 });
          return {
            handoffPrompt: handoff.prompt,
            sealedText: sealedRes.sealed,
            nextSection: handoff.next,
            nonce: handoff.nonce,
            canStitch: true
          };
        } catch {
          // Fallback jika over budget token
        }
      }
    }

    // Fallback standar: Bounded Context 3 giliran terakhir
    const handoffBundle = this.sessionHistory.buildHandoffBundle(originalFullPrompt, 3);
    return {
      handoffPrompt: `${HANDOFF_CAVEMAN_FALLBACK_CONTRACT}${handoffBundle}`,
      sealedText: null,
      nextSection: null,
      nonce: null,
      canStitch: false
    };
  }

  async executeOnProvider(providerName, promptText, onLog, options = {}) {
    const driver = this.drivers[providerName];
    if (!driver) {
      throw new Error(`Driver tidak tersedia untuk provider: ${providerName}`);
    }

    // Peroleh lock mutex untuk provider ini (tunggu antrean hingga 60 detik)
    await this.lockManager.acquire(providerName, 60000);

    try {
      onLog(`[Orchestrator] Mengirim prompt ke ${providerName}...`);
      const sendRes = await driver.sendMessage(promptText, options);

      if (sendRes.rateLimited) {
        return { success: false, rateLimited: true, reason: 'rate_limited_on_send', partialText: '' };
      }

      // Berikan timeout lebih longgar untuk model dengan mode thinking (Qwen, ChatGPT, dan Gemini 4 Argon)
      const timeoutMs = (providerName === 'qwen' || providerName === 'chatgpt' || providerName === 'gemini') ? 420000 : 180000;
      const waitRes = await driver.waitForResponse(timeoutMs);

      if (waitRes.rateLimited) {
        return {
          success: false,
          rateLimited: true,
          reason: 'rate_limited_during_generation',
          partialText: waitRes.text || ''
        };
      }

      if (!waitRes.success || !waitRes.text || waitRes.text.trim().length === 0) {
        throw new Error(`Tidak menerima jawaban valid dari ${providerName}.`);
      }

      return {
        success: true,
        rateLimited: false,
        text: waitRes.text
      };
    } finally {
      this.lockManager.release(providerName);
    }
  }

  /**
   * Evaluator-Optimizer Loop (Domain-Agnostic Engine v2.0+)
   * Berjalan dinamis berbasis scoring konvergensi deterministik (Zero Critical Flaws).
   */
  async runEvaluatorOptimizerLoop(provider, initialAnswer, onLog, options = {}) {
    if (options.evaluate === false || options.interrogate === false) {
      return { answer: initialAnswer, turns: 1, converged: true, audit: null };
    }

    const riskTier = options.tier || options.risk_tier || 2;
    const defaultMaxTurns = riskTier === 1 ? 2 : riskTier === 3 ? 5 : 3;
    const maxTurns = options.safetyMaxTurns || defaultMaxTurns;

    let currentAnswer = initialAnswer;
    let debateHistory = [];
    let debateTurn = 1;

    const currentDomain = options.domain || 'general_technical';

    while (debateTurn < maxTurns) {
      const audit = this.criticEngine.scrutinize(currentAnswer, debateHistory, {
        ...options,
        domain: currentDomain,
        riskTier
      });
      debateHistory.push(audit);

      if (audit.status === 'BLOCKED') {
        onLog(`[Evaluator] 🛑 Model melaporkan blocker/ketergantungan: ${audit.flaws[0]?.title || 'Berkas/input diperlukan'}.`);
        onLog(`[Evaluator] Menghentikan loop sanggahan otonom agar tidak memicu perdebatan halusinasi.`);
        return { answer: currentAnswer, turns: debateTurn, converged: false, blocked: true, audit };
      }

      if (audit.status === 'CONVERGED') {
        onLog(`[Evaluator] ✅ Konvergensi tercapai pada Turn ${debateTurn} (Skor: ${audit.score || 0}). Kriteria terpenuhi.`);
        const blueprint = this.criticEngine.formatBattleTestedBlueprint(
          currentAnswer, audit, debateTurn, debateHistory.slice(0, -1), currentDomain
        );
        return { answer: blueprint, turns: debateTurn, converged: true, audit };
      } else if (audit.status === 'PLATEAU') {
        onLog(`[Evaluator] ⚠️ Stagnasi nalar terdeteksi pada Turn ${debateTurn} (Delta < ${this.criticEngine.deltaMin}).`);
        const blueprint = this.criticEngine.formatBattleTestedBlueprint(
          currentAnswer, audit, debateTurn, debateHistory.slice(0, -1), currentDomain
        );
        return { answer: blueprint, turns: debateTurn, converged: false, audit };
      } else if (audit.status === 'REGRESSED') {
        onLog(`[Evaluator] ⚠️ Regresi logika terdeteksi pada Turn ${debateTurn} (Skor memburuk). Mengembalikan versi terbaik.`);
        const bestAudit = debateHistory.reduce((prev, curr) => ((prev.score || 0) <= (curr.score || 0) ? prev : curr), audit);
        const blueprint = this.criticEngine.formatBattleTestedBlueprint(
          currentAnswer, bestAudit, debateTurn, debateHistory.slice(0, -1), currentDomain
        );
        return { answer: blueprint, turns: debateTurn, converged: false, audit: bestAudit };
      } else {
        // PROGRESS: Masih ada celah yang harus disempurnakan berbasis bukti
        const counterPrompt = this.criticEngine.buildCounterPrompt(audit, debateTurn, currentDomain);
        onLog(`[Evaluator] ⚔️ Turn ${debateTurn}: Ditemukan ${audit.flaws.length} temuan teknis (Skor: ${audit.score}):`);
        audit.flaws.forEach(f => onLog(`  • [${f.dimension}] ${f.title}`));
        onLog(`[Evaluator] Mengirim sanggahan berbasis bukti ke tab browser ${provider}...`);

        const counterRes = await this.executeOnProvider(provider, counterPrompt, onLog, { isInitialTurn: false });
        if (counterRes.rateLimited || !counterRes.success) {
          onLog(`[Evaluator] ⚠️ Tidak dapat melanjutkan perdebatan karena batas kuota/kendala koneksi.`);
          break;
        }

        currentAnswer = normalizeMath(counterRes.text).text;
        this.sessionHistory.addTurn('user', counterPrompt);
        this.sessionHistory.addTurn('assistant', currentAnswer, provider);
        debateTurn++;
      }
    }

    // Jika mencapai batas circuit breaker
    const finalAudit = this.criticEngine.scrutinize(currentAnswer, debateHistory, { ...options, domain: currentDomain, riskTier });
    const blueprint = this.criticEngine.formatBattleTestedBlueprint(
      currentAnswer, finalAudit, debateTurn, debateHistory, currentDomain
    );
    return { answer: blueprint, turns: debateTurn, converged: finalAudit.status === 'CONVERGED', audit: finalAudit };
  }

  /**
   * Alias kompatibilitas ke belakang untuk runEvaluatorOptimizerLoop
   */
  async runInterrogationLoop(provider, initialAnswer, onLog, options = {}) {
    return this.runEvaluatorOptimizerLoop(provider, initialAnswer, onLog, options);
  }

  async ask(prompt, options = {}) {
    const { forceModel = null, files = [], onLog = console.log } = options;
    const startTime = Date.now();

    // 0. Stage 1: Lyra 4-D Prompt Optimizer
    let basePrompt = prompt;
    let optimizationMeta = null;
    let detectedDomain = options.domain || 'general_technical';
    if (options.optimizePrompt !== false) {
      const synthRes = this.promptSynthesizer.synthesize(prompt, options);
      basePrompt = synthRes.optimizedPrompt;
      optimizationMeta = synthRes.metadata;
      detectedDomain = synthRes.domain;
      if (options.previewPrompt !== false && typeof onLog === 'function') {
        onLog(synthRes.previewBox);
      }
    }

    // 1. Validasi & resolusi file langsung dari disk
    const fileBundle = this.resolveFiles(files);
    let fullPrompt = `${basePrompt}${fileBundle}`;

    if (options.resetSession || options.newChat) {
      this.sessionHistory.clear();
      if (forceModel) {
        this.cooldowns[forceModel] = 0;
        this.cooldownStore.clear(forceModel);
      } else {
        this.cooldowns = { claude: 0, gemini: 0, qwen: 0, chatgpt: 0 };
        this.cooldownStore.clearAll();
      }
      await this.browserManager.resetTabs(onLog, forceModel || null);
    }

    const isFirstTurn = options.isInitialTurn !== undefined
      ? options.isInitialTurn
      : (this.sessionHistory.getTurns().length === 0);

    // Suntikkan kontrak Engineering Caveman pada prompt generate untuk konsistensi seluruh model (Claude, Gemini, Qwen, ChatGPT)
    if (isFirstTurn) {
      fullPrompt = `${ENGINEERING_CAVEMAN_CONTRACT}${fullPrompt}`;
    } else {
      fullPrompt = `[PENGINGAT KONTRAK: Pertahankan pola Answer-First [THING] [ACTION] [REASON] dengan kurung siku, Zero Ceremony, dan Floor LaTeX/Kode utuh]\n\n${fullPrompt}`;
    }

    const now = Date.now();

    let failoverTriggered = false;
    let initialProvider = null;
    let lastFailedProvider = null;
    let lastPartialText = '';
    let activeHandoffState = null;
    let currentPromptToSend = fullPrompt;

    // 2. Jika dipaksa menggunakan model tertentu
    if (forceModel) {
      if (!this.drivers[forceModel]) {
        throw new Error(`Model '${forceModel}' tidak didukung. Pilihan: claude, gemini, qwen, chatgpt`);
      }

      onLog(`[Orchestrator] Mode terarah: Mengirim langsung ke ${forceModel}...`);
      this.sessionHistory.addTurn('user', prompt);

      let forceRes;
      try {
        forceRes = await this.executeOnProvider(forceModel, fullPrompt, onLog, { ...options, isInitialTurn: isFirstTurn });
      } catch (err) {
        if (err.message && err.message.includes('[AUTH_REQUIRED]')) {
          throw err;
        }
        forceRes = { rateLimited: true, reason: err.message };
      }

      if (forceRes.rateLimited) {
        const rawLimitText = forceRes.resetText || (this.drivers[forceModel].lastRateLimitDetails && this.drivers[forceModel].lastRateLimitDetails.rawText) || forceRes.reason || '';
        const parsedEpoch = parseResetText(rawLimitText, { nowMs: Date.now() });
        let resetAt;
        let source;
        if (parsedEpoch && parsedEpoch > Date.now()) {
          resetAt = parsedEpoch;
          source = 'text';
          const remainingMinutes = Math.ceil((resetAt - Date.now()) / 60000);
          onLog(`[Orchestrator] 🕒 Terdeteksi waktu reset kuota dari UI ${forceModel}: ${new Date(resetAt).toLocaleTimeString()} (${remainingMinutes} menit lagi).`);
        } else {
          const cooldownDuration = forceModel === 'qwen' ? 12 * 60 * 60 * 1000 : 60 * 60 * 1000;
          resetAt = Date.now() + cooldownDuration;
          source = 'backoff';
        }
        this.cooldownStore.set(forceModel, {
          resetAt,
          blockedAt: Date.now(),
          source,
          rawText: rawLimitText
        });
        this.cooldowns[forceModel] = resetAt;

        if (options.strict || options.noFailover) {
          throw new Error(`Batas kuota tercapai pada model ${forceModel}. Cooldown aktif hingga ${new Date(resetAt).toLocaleTimeString()}.`);
        }
        onLog(`⚠️  [AUTO-FAILOVER] Model ${forceModel} tidak dapat menggunakan model default/mencapai batas kuota! Mengoper tugas ke provider berikutnya di rantai...`);
        failoverTriggered = true;
        initialProvider = forceModel;
        lastFailedProvider = forceModel;
      } else {
        this.cooldownStore.clear(forceModel);
        this.cooldowns[forceModel] = 0;
        const normalizedMath = normalizeMath(forceRes.text).text;
        this.sessionHistory.addTurn('assistant', normalizedMath, forceModel);

        // Jalankan Evaluator-Optimizer Loop
        const interrogationRes = await this.runEvaluatorOptimizerLoop(forceModel, normalizedMath, onLog, { ...options, domain: detectedDomain });
        const finalAnswer = interrogationRes.answer;

        this.logExecution({
          provider: forceModel,
          prompt_length: fullPrompt.length,
          response_length: finalAnswer.length,
          duration_ms: Date.now() - startTime,
          failover: false,
          files_count: files.length,
          evaluator_turns: interrogationRes.turns,
          evaluator_converged: interrogationRes.converged,
          amtil_turns: interrogationRes.turns,
          amtil_converged: interrogationRes.converged
        });

        return {
          answer: finalAnswer,
          provider_used: forceModel,
          failover: false,
          evaluator_turns: interrogationRes.turns,
          evaluator_converged: interrogationRes.converged,
          amtil_turns: interrogationRes.turns,
          amtil_converged: interrogationRes.converged,
          optimization_meta: optimizationMeta
        };
      }
    }

    // 3. Rantai Eksekusi Bertingkat (Failover Chain): Claude -> Gemini -> Qwen -> ChatGPT
    let failoverChain = ['claude', 'gemini', 'qwen', 'chatgpt'];
    if (forceModel && failoverTriggered) {
      failoverChain = failoverChain.filter(c => c !== forceModel);
    }
    let lastError = null;

    for (let i = 0; i < failoverChain.length; i++) {
      const candidate = failoverChain[i];

      // Periksa status cooldown (predictive lease dari CooldownStore)
      const storedCooldown = this.cooldownStore.get(candidate);
      const activeCooldown = Math.max(this.cooldowns[candidate] || 0, (storedCooldown && storedCooldown.resetAt) || 0);
      if (now < activeCooldown) {
        const remainingMinutes = Math.ceil((activeCooldown - now) / 60000);
        onLog(`[Orchestrator] Provider '${candidate}' dalam lease cooldown (${remainingMinutes} menit tersisa, reset: ${new Date(activeCooldown).toLocaleTimeString()}). Dilewati.`);
        continue;
      }

      if (!initialProvider) {
        initialProvider = candidate;
      } else {
        // Ini adalah giliran fallback / failover
        failoverTriggered = true;
        onLog(`📦  Menyusun Handoff Bundle (Stream Recovery v1.5) dari ${lastFailedProvider || initialProvider} ke ${candidate}...`);
        activeHandoffState = this.recoverSessionHandoff({
          previousProvider: lastFailedProvider || initialProvider,
          candidateProvider: candidate,
          partialText: lastPartialText,
          taskPrompt: prompt,
          originalFullPrompt: fullPrompt
        });
        currentPromptToSend = activeHandoffState.handoffPrompt;
      }

      try {
        const res = await this.executeOnProvider(candidate, currentPromptToSend, onLog, { isInitialTurn: isFirstTurn && !failoverTriggered });

        if (res.rateLimited) {
          const rawLimitText = res.resetText || (this.drivers[candidate].lastRateLimitDetails && this.drivers[candidate].lastRateLimitDetails.rawText) || res.reason || '';
          const parsedEpoch = parseResetText(rawLimitText, { nowMs: Date.now() });
          let resetAt;
          let source;
          if (parsedEpoch && parsedEpoch > Date.now()) {
            resetAt = parsedEpoch;
            source = 'text';
            const remainingMinutes = Math.ceil((resetAt - Date.now()) / 60000);
            onLog(`[Orchestrator] 🕒 Terdeteksi waktu reset kuota dari UI ${candidate}: ${new Date(resetAt).toLocaleTimeString()} (${remainingMinutes} menit lagi).`);
          } else {
            const cooldownDuration = candidate === 'qwen' ? 12 * 60 * 60 * 1000 : 60 * 60 * 1000;
            resetAt = Date.now() + cooldownDuration;
            source = 'backoff';
          }
          this.cooldownStore.set(candidate, {
            resetAt,
            blockedAt: Date.now(),
            source,
            rawText: rawLimitText
          });
          this.cooldowns[candidate] = resetAt;

          lastFailedProvider = candidate;
          lastPartialText = res.partialText || '';
          onLog(`⚠️  [FAILOVER TRIGGERED] Batas kuota ${candidate} tercapai! Mengaktifkan cooldown hingga ${new Date(resetAt).toLocaleTimeString()}.`);
          continue; // Lanjut ke provider berikutnya di rantai
        }

        // Berhasil mendapatkan respons: hapus record cooldown (reclaim sukses)
        this.cooldownStore.clear(candidate);
        this.cooldowns[candidate] = 0;
        let finalAnswer = res.text;
        if (activeHandoffState && activeHandoffState.canStitch && activeHandoffState.sealedText) {
          onLog(`🧵  Menjahit (stitching) output lanjutan dari ${candidate} dengan teks tersegel...`);
          const stitchRes = stitch(activeHandoffState.sealedText, res.text, { next: activeHandoffState.nextSection });
          finalAnswer = stitchRes.ok ? stitchRes.text : `${activeHandoffState.sealedText}\n\n${res.text}`;
        }

        // Normalisasi format matematika LaTeX & proteksi delimiter KaTeX
        const mathNormalized = normalizeMath(finalAnswer).text;
        this.sessionHistory.addTurn('user', prompt);
        this.sessionHistory.addTurn('assistant', mathNormalized, candidate);

        // Jalankan Evaluator-Optimizer Loop
        const interrogationRes = await this.runEvaluatorOptimizerLoop(candidate, mathNormalized, onLog, { ...options, domain: detectedDomain });
        finalAnswer = interrogationRes.answer;

        this.logExecution({
          provider: candidate,
          prompt_length: currentPromptToSend.length,
          response_length: finalAnswer.length,
          duration_ms: Date.now() - startTime,
          failover: failoverTriggered,
          failover_from: failoverTriggered ? (lastFailedProvider || initialProvider) : null,
          files_count: files.length,
          amtil_turns: interrogationRes.turns,
          amtil_converged: interrogationRes.converged
        });

        return {
          answer: finalAnswer,
          provider_used: candidate,
          failover: failoverTriggered,
          failover_detail: failoverTriggered ? { from: (lastFailedProvider || initialProvider), to: candidate, reason: 'quota_limit' } : null,
          evaluator_turns: interrogationRes.turns,
          evaluator_converged: interrogationRes.converged,
          amtil_turns: interrogationRes.turns,
          amtil_converged: interrogationRes.converged,
          optimization_meta: optimizationMeta
        };
      } catch (err) {
        // Jika error adalah AUTH_REQUIRED, JANGAN failover! Pengguna harus tahu segera
        if (err.message && err.message.includes('[AUTH_REQUIRED]')) {
          throw err;
        }

        lastError = err;
        onLog(`[Orchestrator] Kesalahan pada ${candidate}: ${err.message}. Mencoba provider berikutnya jika ada...`);
      }
    }

    throw new Error(
      `Seluruh provider dalam rantai failover gagal atau mencapai batas kuota.\n` +
      `Kesalahan terakhir: ${lastError ? lastError.message : 'Semua provider dalam status cooldown'}`
    );
  }
}

module.exports = Orchestrator;
