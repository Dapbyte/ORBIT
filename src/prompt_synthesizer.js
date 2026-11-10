/**
 * Prompt Synthesizer (Lyra 4-D Prompt Optimizer)
 * Mengimplementasikan 4-D Methodology:
 * 1. DECONSTRUCT: Ekstraksi intent, entitas kunci, dan domain secara data-driven.
 * 2. DIAGNOSE: Audit celah kejelasan, batasan pagu, durasi, dan reliabilitas.
 * 3. DEVELOP: Penerimaan persona ahli, penyuntikan Negative Constraints & COTS rules.
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
  deconstruct(rawText) {
    const text = (rawText || '').trim();
    const textLower = text.toLowerCase();
    
    // Deteksi Domain secara Data-Driven dari konfigurasi template
    let detectedDomain = 'general_technical';
    const domains = this.domainRules.domains || {};

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

    // Deteksi Platform Target jika disebutkan
    let targetPlatform = 'universal';
    if (/\bqwen\b/i.test(textLower)) targetPlatform = 'qwen';
    else if (/\bclaude\b/i.test(textLower)) targetPlatform = 'claude';
    else if (/\b(?:chatgpt|gpt)\b/i.test(textLower)) targetPlatform = 'chatgpt';

    return {
      rawText: text,
      detectedDomain,
      targetPlatform,
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

    return {
      clarityScore: Math.max(10, 100 - (gaps.length * 20)),
      gaps,
      severity: gaps.length >= 3 ? 'HIGH' : gaps.length > 0 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * 3. DEVELOP
   * Merakit teknik Lyra secara dinamis dari schema domain rules
   */
  develop(deconstructed, diagnosis, options = {}) {
    const domainConfig = (this.domainRules.domains && this.domainRules.domains[deconstructed.detectedDomain]) || null;
    const techniquesApplied = [
      'Role & Persona Lock',
      'Quantitative Boundary Constraints',
      'Negative Constraints (Pantangan Keras)',
      'Domain Evaluation Protocol Enforcement',
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

    const sections = [];
    if (systemPersona) sections.push(systemPersona);
    if (boundaryConstraints) sections.push(boundaryConstraints);
    if (negativeConstraints) sections.push(negativeConstraints);
    if (formatInstructions) sections.push(formatInstructions);
    sections.push(`### PERMINTAAN PENGGUNA ASLI:\n${deconstructed.rawText}`);

    const constructedPrompt = sections.join('\n\n');

    return {
      constructedPrompt,
      techniquesApplied,
      rulesInjected
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

    return {
      optimizedPrompt: developed.constructedPrompt,
      domain: deconstructed.detectedDomain,
      metadata: {
        domain: deconstructed.detectedDomain,
        targetPlatform: deconstructed.targetPlatform,
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
    const deconstructed = this.deconstruct(rawInput);
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
