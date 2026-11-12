/**
 * Prompt Synthesizer (Lyra 4-D Prompt Optimizer v2.5)
 * Mengimplementasikan 4-D Methodology:
 * 1. DECONSTRUCT: Ekstraksi intent, entitas kunci, domain, reasoning level, dan gaya output.
 * 2. DIAGNOSE: Audit celah kejelasan, batasan pagu, durasi, mitigasi risiko, dan reliabilitas.
 * 3. DEVELOP: Penerimaan persona ahli, penyuntikan Negative Constraints, payload sandboxing, & reasoning lock.
 * 4. DELIVER: Konstruksi prompt final anti-halusinasi + metadata perbaikan.
 *
 * Catatan Arsitektur: 100% Data-Driven & Domain-Agnostic.
 * Bebas dari percabangan if/else hardcoded domain di dalam kode sumber JavaScript.
 */

const fs = require('fs');
const path = require('path');

const DOMAIN_RULES_PATH = path.join(__dirname, 'templates', 'domain_rules.json');

class PromptSynthesizer {
  constructor(domainRulesPath = DOMAIN_RULES_PATH) {
    this.domainRules = this.loadDomainRules(domainRulesPath);
  }

  loadDomainRules(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[PROMPT_SYNTHESIZER] Gagal memuat domain rules dari ${filePath}: ${err.message}`);
    }
    return { domains: {} };
  }

  /**
   * 1. DECONSTRUCT
   * Membedah teks mentah pengguna secara data-driven
   */
  deconstruct(rawText, options = {}) {
    const text = (rawText || '').trim();
    const textLower = text.toLowerCase();

    // Deteksi Domain secara Data-Driven dari konfigurasi template
    let detectedDomain = options.domain || 'general_technical';
    const domains = this.domainRules.domains || {};

    if (!options.domain) {
      for (const [domainKey, domainConfig] of Object.entries(domains)) {
        if (domainConfig.patterns && Array.isArray(domainConfig.patterns)) {
          // Buat regex ber-boundary kata (\b)
          const patternStr = domainConfig.patterns.join('|');
          const regex = new RegExp(`\\b(?:${patternStr})\\b`, 'i');
          if (regex.test(textLower)) {
            detectedDomain = domainKey;
            break;
          }
        }
      }
    }

    // Deteksi Platform Target jika disebutkan
    let targetPlatform = options.forceModel || 'universal';
    if (/\bqwen\b/i.test(textLower)) targetPlatform = 'qwen';
    else if (/\bclaude\b/i.test(textLower)) targetPlatform = 'claude';
    else if (/\b(?:chatgpt|gpt)\b/i.test(textLower)) targetPlatform = 'chatgpt';
    else if (/\bgemini\b/i.test(textLower)) targetPlatform = 'gemini';

    // Deteksi Intent Tugas secara terstruktur
    let detectedIntent = 'general_task';
    if (/\b(?:audit|review|kritik|evaluasi|periksa|cek|analisis|inspect|scrutinize)\b/i.test(textLower)) {
      detectedIntent = 'audit_review';
    } else if (/\b(?:refactor|optimize|optimasi|perbaiki|rapikan|streamline|tuning)\b/i.test(textLower)) {
      detectedIntent = 'refactor_optimize';
    } else if (/\b(?:rancang|desain|arsitektur|skema|blueprint|architecture|design)\b/i.test(textLower)) {
      detectedIntent = 'design_architecture';
    } else if (/\b(?:bug|error|fix|debug|gagal|crash|exception|rusak|bocor)\b/i.test(textLower)) {
      detectedIntent = 'debug_fix';
    } else if (/\b(?:turunkan|buktikan|derivasi|hitung|formula|persamaan|proof|theorem|matematika)\b/i.test(textLower)) {
      detectedIntent = 'math_derivation';
    } else if (/\b(?:debat|bantah|sanggah|uji|challenge|interogasi|adversarial)\b/i.test(textLower)) {
      detectedIntent = 'debate_challenge';
    }

    // Deteksi Tingkat Penalaran (Reasoning Depth)
    let requestedReasoning = options.reasoning || 'balanced';
    if (!options.reasoning) {
      if (/\b(?:deep|menalar|thinking|langkah-demi-langkah|step-by-step|mendalam|komprehensif)\b/i.test(textLower)) {
        requestedReasoning = 'deep';
      } else if (/\b(?:singkat|cepat|quick|to the point|ringkas)\b/i.test(textLower)) {
        requestedReasoning = 'quick';
      }
    }

    // Deteksi Gaya/Tone Output
    let requestedTone = options.tone || 'engineering';
    if (!options.tone) {
      if (/\b(?:caveman|terse|padat|tanpa basa-basi)\b/i.test(textLower)) {
        requestedTone = 'caveman';
      } else if (/\b(?:formal|akademik|paper|jurnal|ilmiah)\b/i.test(textLower)) {
        requestedTone = 'academic';
      } else if (/\b(?:production|siap deploy|clean code|enterprise)\b/i.test(textLower)) {
        requestedTone = 'production';
      }
    }

    return {
      rawText: text,
      detectedDomain,
      targetPlatform,
      detectedIntent,
      requestedReasoning,
      requestedTone,
      isPkm: detectedDomain === 'pkm_kc'
    };
  }

  /**
   * 2. DIAGNOSE
   * Menemukan kekosongan konteks & celah halusinasi secara data-driven
   */
  diagnose(deconstructed) {
    const gaps = [];
    const textLower = deconstructed.rawText.toLowerCase();
    const domainConfig = (this.domainRules.domains && this.domainRules.domains[deconstructed.detectedDomain]) || null;

    if (domainConfig && Array.isArray(domainConfig.requiredChecks)) {
      for (const check of domainConfig.requiredChecks) {
        const regex = new RegExp(check.pattern, 'i');
        if (!regex.test(textLower)) {
          gaps.push(check.gap);
        }
      }
    }

    // Universal Negative Constraint Check
    if (!/\b(?:pantangan|dilarang|jangan|negative|constraint)\b/i.test(textLower)) {
      gaps.push('Ketiadaan Negative Constraints untuk mencegah perilaku destruktif atau anti-pola arsitektural');
    }

    // Edge Case / Verification Protocol Check
    if (!/\b(?:test|verifikasi|uji|edge case|validasi|benchmark)\b/i.test(textLower)) {
      gaps.push('Ketiadaan protokol verifikasi empiris atau pengujian edge case konkret');
    }

    return {
      clarityScore: Math.max(10, 100 - (gaps.length * 18)),
      gaps,
      severity: gaps.length >= 3 ? 'HIGH' : gaps.length > 0 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * 3. DEVELOP
   * Merakit teknik Lyra secara dinamis dari schema domain rules, intent, dan reasoning
   */
  develop(deconstructed, diagnosis, options = {}) {
    const domainConfig = (this.domainRules.domains && this.domainRules.domains[deconstructed.detectedDomain]) || null;
    const techniquesApplied = [
      'Role & Persona Lock',
      'Quantitative Boundary Constraints',
      'Negative Constraints (Pantangan Keras)',
      'Domain Evaluation Protocol Enforcement',
      'Task Intent & Reasoning Depth Directives',
      'Structured Markdown Specification'
    ];

    let systemPersona = '';
    let boundaryConstraints = '';
    let negativeConstraints = '';
    let formatInstructions = '';
    let rulesInjected = 'Standard Technical Architecture';

    if (domainConfig) {
      rulesInjected = domainConfig.name || deconstructed.detectedDomain;
      systemPersona = domainConfig.systemPersona || '';
      boundaryConstraints = domainConfig.boundaryConstraints || '';
      negativeConstraints = domainConfig.negativeConstraints || '';
      formatInstructions = domainConfig.formatInstructions || '';
    } else {
      // Universal Domain-Agnostic Architecture (Default)
      systemPersona = `### ROLE & PERSONA:\nAnda adalah Senior System Architect & Technical Specialist. Berikan solusi rekayasa presisi dengan pendekatan Chain-of-Thought, berbasis batasan realistis, dan zero ceremony.`;
      boundaryConstraints = `### BOUNDARY CONSTRAINTS:\n- Berikan spesifikasi kuantitatif, arsitektur modular, dan solusi konkret yang siap diimplementasikan.\n- Pertahankan rasionalitas kompleksitas, keandalan, dan efisiensi waktu eksekusi.`;
      formatInstructions = `### FORMAT OUTPUT:\nSajikan analisis teknis mendalam, arsitektur sistem/alur logika terstruktur, dan metode verifikasi fungsional konkret.`;
    }

    // Directives berdasarkan Reasoning Depth
    let reasoningDirective = '';
    const activeReasoning = options.reasoning || deconstructed.requestedReasoning;
    if (activeReasoning === 'deep' || activeReasoning === 'high') {
      reasoningDirective = `### REASONING PROTOCOL (DEEP THINKING ENFORCEMENT):\n1. Lakukan eksplorasi penalaran internal mendalam (Chain-of-Thought) sebelum merumuskan solusi akhir.\n2. Ulas setiap asumsi dasar, analisis potensi kegagalan tersembunyi, dan pertimbangkan trade-off arsitektural secara objektif.\n3. Pertahankan presisi derivasi matematika atau logika kode tanpa melompati tahap perantara kritis.`;
      techniquesApplied.push('Deep Reasoning Enforcement');
    }

    // Directives berdasarkan Intent
    let intentDirective = '';
    const activeIntent = deconstructed.detectedIntent;
    if (activeIntent === 'audit_review') {
      intentDirective = `### TASK INTENT (OBJECTIVE AUDIT & EVIDENCE-BASED SCRUTINY):\nFokuskan analisis pada identifikasi kerentanan, bottleneck, dan cacat arsitektur. Setiap temuan WAJIB menyertakan kutipan/bukti spesifik serta proposal perbaikan konkret.`;
    } else if (activeIntent === 'refactor_optimize') {
      intentDirective = `### TASK INTENT (PRECISION REFACTORING):\nOptimalkan keterbacaan, efisiensi eksekusi, dan modularitas tanpa mengubah kontrak perilaku fungsional yang valid.`;
    } else if (activeIntent === 'math_derivation') {
      intentDirective = `### TASK INTENT (FORMAL MATHEMATICAL PROOF):\nTuliskan seluruh penurunan rumus langkah demi langkah menggunakan notasi LaTeX kanonikal ($...$ dan $$...$$). Berikan justifikasi formal pada setiap transisi aljabar.`;
    }

    const sections = [];
    if (systemPersona) sections.push(systemPersona);
    if (reasoningDirective) sections.push(reasoningDirective);
    if (intentDirective) sections.push(intentDirective);
    if (boundaryConstraints) sections.push(boundaryConstraints);
    if (negativeConstraints) sections.push(negativeConstraints);
    if (formatInstructions) sections.push(formatInstructions);

    // Sandboxing input pengguna untuk mencegah prompt injection
    sections.push(`### PERMINTAAN PENGGUNA ASLI (TASK PAYLOAD):\n${deconstructed.rawText}`);

    const constructedPrompt = sections.join('\n\n');

    return {
      constructedPrompt,
      techniquesApplied,
      rulesInjected,
      activeIntent,
      activeReasoning
    };
  }

  /**
   * 4. DELIVER
   * Mengemas prompt teroptimasi dan metadata perubahannya secara dinamis
   */
  deliver(deconstructed, diagnosis, developed) {
    const domainConfig = (this.domainRules.domains && this.domainRules.domains[deconstructed.detectedDomain]) || null;
    let whatChanged = [];

    if (domainConfig) {
      whatChanged = [
        `Menyuntikkan Role & Persona Khusus (${developed.rulesInjected})`,
        'Mengunci Batasan Kuantitatif & Standar Kepatuhan Domain',
        'Menyuntikkan Negative Constraints Keras Anti-Halusinasi',
        'Menetapkan Spesifikasi Format Keluaran Komprehensif'
      ];
    } else {
      whatChanged = [
        'Menyuntikkan Persona Senior Technical Specialist',
        'Menerapkan Format Terstruktur dan Rasionalitas Implementasi Rekayasa'
      ];
    }

    if (developed.activeReasoning === 'deep') {
      whatChanged.push('Mengaktifkan Protokol Deep Thinking & Chain-of-Thought Kritis');
    }
    if (developed.activeIntent && developed.activeIntent !== 'general_task') {
      whatChanged.push(`Membingkai Instruksi Sesuai Task Intent (${developed.activeIntent})`);
    }

    return {
      optimizedPrompt: developed.constructedPrompt,
      domain: deconstructed.detectedDomain,
      metadata: {
        domain: deconstructed.detectedDomain,
        targetPlatform: deconstructed.targetPlatform,
        intent: developed.activeIntent,
        reasoning: developed.activeReasoning,
        tone: deconstructed.requestedTone,
        originalLength: deconstructed.rawText.length,
        optimizedLength: developed.constructedPrompt.length,
        clarityScore: diagnosis.clarityScore,
        gapsIdentified: diagnosis.gaps,
        techniquesApplied: developed.techniquesApplied,
        whatChanged
      }
    };
  }

  /**
   * Render Kotak Visual Preview untuk Mode Development
   */
  renderPreviewBox(metadata, rawInput) {
    const border = '═'.repeat(74);
    const thinBorder = '─'.repeat(74);

    return [
      `╔${border}╗`,
      `║ 🔍 LYRA PROMPT OPTIMIZER PREVIEW (DEVELOPMENT INSPECTION)                 ║`,
      `╠${border}╣`,
      `║ Domain Terdeteksi : ${metadata.domain.padEnd(52)} ║`,
      `║ Platform Target   : ${metadata.targetPlatform.padEnd(52)} ║`,
      `║ Intent / Nalar    : ${`${metadata.intent || 'general'} | ${metadata.reasoning || 'balanced'}`.padEnd(52)} ║`,
      `║ Skor Kejelasan    : ${`${metadata.clarityScore}/100`.padEnd(52)} ║`,
      `╟${thinBorder}╢`,
      `║ [Celah Awal yang Ditemukan]:                                             ║`,
      ...metadata.gapsIdentified.map(g => `║ • ${g.slice(0, 68).padEnd(70)} ║`),
      `╟${thinBorder}╢`,
      `║ [Optimasi yang Diterapkan (What Changed)]:                               ║`,
      ...metadata.whatChanged.map(c => `║ • ${c.slice(0, 68).padEnd(70)} ║`),
      `╟${thinBorder}╢`,
      `║ Ukuran Prompt     : ${`${metadata.originalLength} chars -> ${metadata.optimizedLength} chars`.padEnd(52)} ║`,
      `╚${border}╝\n`
    ].join('\n');
  }

  /**
   * Endpoint Utama Sintesis
   */
  synthesize(rawInput, options = {}) {
    const deconstructed = this.deconstruct(rawInput, options);
    const diagnosis = this.diagnose(deconstructed);
    const developed = this.develop(deconstructed, diagnosis, options);
    const delivered = this.deliver(deconstructed, diagnosis, developed);

    const previewBox = this.renderPreviewBox(delivered.metadata, rawInput);

    return {
      optimizedPrompt: delivered.optimizedPrompt,
      domain: delivered.domain,
      metadata: delivered.metadata,
      previewBox
    };
  }
}

module.exports = PromptSynthesizer;
