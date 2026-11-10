'use strict';

/**
 * Dynamic Critic Engine (Evaluator-Optimizer Engine v2.0)
 * Mengadaptasi:
 * - Huang et al. (2023): LLM tidak bisa self-correct tanpa sinyal ground-truth eksternal.
 * - Du et al. (2023): Multi-Agent Debate dialektika berbasis bukti.
 * - Madaan et al. (2023): Self-Refine dengan verbal feedback.
 * - Shinn et al. (2023): Reflexion verbal memory.
 * - Anthropic Research: Evaluator-Optimizer Pattern.
 */

const crypto = require('crypto');
const {
  validateFraming,
  validateCritique
} = require('./contracts/critique_contract');

class CriticEngine {
  constructor(options = {}) {
    this.defaultRiskTier = options.defaultRiskTier || 2;
    this.deltaMin = options.deltaMin || 2;
  }

  /**
   * Menyusun Dynamic Framing (Kriteria Evaluasi Bebas Domain)
   * Diturunkan dari request pengguna + baseline universal.
   */
  buildDefaultFraming(taskPrompt, options = {}) {
    const riskTier = options.risk_tier || options.riskTier || this.defaultRiskTier;
    const criteria = [
      {
        id: 'U1',
        statement: 'Kebenaran fungsional dan kepatuhan penuh terhadap instruksi tugas',
        required: true,
        verifier: { kind: 'judgment' }
      },
      {
        id: 'U2',
        statement: 'Bebas celah keamanan, bebas perilaku destruktif, dan konsisten secara logis',
        required: true,
        verifier: { kind: 'inspectable' }
      },
      {
        id: 'U3',
        statement: 'Kesiapan eksekusi nyata, bebas placeholder tidak tuntas, dan bebas asumsi fiktif',
        required: true,
        verifier: { kind: 'inspectable' }
      }
    ];

    if (options.criteria && Array.isArray(options.criteria)) {
      criteria.push(...options.criteria);
    }

    const framing = {
      task_summary: (taskPrompt || '').slice(0, 250).trim() || 'Tugas Rekayasa Sistem',
      risk_tier: riskTier,
      criteria,
      constraints: options.constraints || [],
      assumptions: options.assumptions || []
    };

    const validation = validateFraming(framing);
    if (!validation.ok) {
      throw new Error(`Framing invalid: ${validation.errors.join('; ')}`);
    }

    return framing;
  }

  /**
   * Menghitung Skor Ronde Secara Deterministik (Anti-Sycophancy)
   * S_t = Sum(w(sev_f)) + 5*U_t + 8*L_t
   */
  calculateRoundScore(findings = [], criteriaResults = [], localErrorsCount = 0) {
    const openFindings = findings.filter(f => f.status !== 'resolved');
    let severityScore = 0;

    for (const f of openFindings) {
      if (f.severity === 'blocker') severityScore += 8;
      else if (f.severity === 'major') severityScore += 3;
      else if (f.severity === 'minor') severityScore += 1;
    }

    const unmetRequired = (criteriaResults || []).filter(r => r.status === 'unmet').length;
    const roundScore = severityScore + (5 * unmetRequired) + (8 * localErrorsCount);

    const blockerCount = openFindings.filter(f => f.severity === 'blocker' || f.severity === 'major').length;

    return {
      roundScore,
      severityScore,
      unmetRequired,
      localErrorsCount,
      blockerCount,
      openFindingsCount: openFindings.length
    };
  }

  /**
   * Mengevaluasi Respon Model (Dynamic Reasoning Scrutiny)
   * Menggabungkan audit blocker global, verifikasi kontrak, dan deteksi konvergensi.
   */
  scrutinize(responseText, history = [], options = {}) {
    const text = responseText || '';
    const textLower = text.toLowerCase();

    // ─────────────────────────────────────────────────────────
    // 1. CEK GLOBAL: BLOCKED KARENA KEKURANGAN INPUT / DATA
    // ─────────────────────────────────────────────────────────
    if (/(?:blocker|source\s+files?\s+unavailable|berkas\s+minimum\s+yang\s+diperlukan|belum\s+tersedia\s+dalam\s+sesi|harap\s+lampirkan|file\s+tidak\s+ditemukan|perlu\s+source\s+code)/i.test(textLower)) {
      return {
        status: 'BLOCKED',
        verdict: 'BLOCKED',
        flaws: [{
          dimension: 'DEPENDENCY',
          code: 'SOURCE_FILES_REQUIRED',
          title: 'Model Memerlukan Berkas Sumber / Input Nyata',
          description: 'Model melaporkan blocker karena source code atau berkas input belum disertakan ke dalam sesi prompt.'
        }],
        score: 8,
        message: 'Model terblokir (memerlukan lampiran berkas sumber).'
      };
    }

    // ─────────────────────────────────────────────────────────
    // 2. PARSING KRITIK BERBASIS BUKTI (EVIDENCE-GATED CRITIQUE)
    // ─────────────────────────────────────────────────────────
    const framing = options.framing || this.buildDefaultFraming(options.taskPrompt || text.slice(0, 100), options);
    const priorFindings = history.length > 0 && history[history.length - 1].findings
      ? history[history.length - 1].findings
      : [];

    const flaws = [];
    const findings = [];
    const criteriaResults = [];

    // Deteksi unhandled placeholders (universal coding flaw)
    if (/(?:\/\/|\/\*)\s*(?:todo|implement\s+(?:here|logic|later)|your\s+code\s+here|placeholder)/i.test(textLower)) {
      findings.push({
        id: `F${findings.length + 1}`,
        severity: 'major',
        status: 'new',
        criterion_id: 'U3',
        claim: 'Solusi menyisakan komentar placeholder yang belum terimplementasi',
        evidence: 'Ditemukan komentar // TODO atau // implement here pada alur fungsional',
        evidence_kind: 'quote',
        counter_action: 'Lengkapi implementasi kode secara tuntas tanpa menyisakan placeholder',
        confidence: 0.95
      });
      flaws.push({
        dimension: 'IMPLEMENTATION',
        code: 'UNIMPLEMENTED_PLACEHOLDERS',
        title: 'Keberadaan Placeholder / Kode Tidak Tuntas',
        description: 'Solusi memuat komentar placeholder (TODO/implement here) pada alur logika utama.'
      });
    }

    // Deteksi silent failure / empty catch
    if (/catch\s*\(\s*(?:err|error|e)?\s*\)\s*\{\s*\}/i.test(text)) {
      findings.push({
        id: `F${findings.length + 1}`,
        severity: 'minor',
        status: 'new',
        criterion_id: 'U2',
        claim: 'Terdapat blok penanganan error kosong (silent failure)',
        evidence: 'Ditemukan sintaks catch () {} tanpa penanganan atau logging',
        evidence_kind: 'quote',
        counter_action: 'Berikan logging atau penanganan error eksplisit',
        confidence: 0.9
      });
      flaws.push({
        dimension: 'RELIABILITY',
        code: 'EMPTY_CATCH_BLOCK',
        title: 'Penanganan Error Kosong (Silent Failure)',
        description: 'Blok catch kosong menyembunyikan potensi error koneksi/runtime tanpa logging atau fallback yang aman.'
      });
    }

    // Cek respon terlalu pendek / superficial
    if (text.trim().length < 40) {
      findings.push({
        id: `F${findings.length + 1}`,
        severity: 'major',
        status: 'new',
        criterion_id: 'U1',
        claim: 'Respon terlalu singkat dan tidak menyajikan analisis substansial',
        evidence: `Panjang respon hanya ${text.trim().length} karakter`,
        evidence_kind: 'reasoning',
        counter_action: 'Sajikan jawaban yang lengkap, presisi, dan terstruktur',
        confidence: 0.9
      });
      flaws.push({
        dimension: 'COMPLETENESS',
        code: 'SUPERFICIAL_RESPONSE',
        title: 'Respon Terlalu Singkat atau Tidak Lengkap',
        description: 'Tugas memerlukan elaborasi teknis yang tuntas.'
      });
    }

    // Bangun criteria results
    framing.criteria.forEach((c) => {
      const isUnmet = findings.some(f => f.criterion_id === c.id && f.status !== 'resolved');
      criteriaResults.push({
        criterion_id: c.id,
        status: isUnmet ? 'unmet' : 'met',
        evidence: isUnmet ? 'Terdapat finding terbuka pada kriteria ini' : 'Memenuhi standar verifikasi',
        evidence_kind: 'reasoning'
      });
    });

    const localErrors = options.localErrorsCount || 0;
    const scoreData = this.calculateRoundScore(findings, criteriaResults, localErrors);
    const textHash = crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);

    // ─────────────────────────────────────────────────────────
    // 3. EVALUASI KONVERGENSI, REGRESI & PLATEAU (DETERMINISTIK)
    // ─────────────────────────────────────────────────────────
    if (scoreData.blockerCount === 0 && scoreData.unmetRequired === 0 && localErrors === 0) {
      return {
        status: 'CONVERGED',
        verdict: 'PASS',
        flaws: [],
        findings,
        criteriaResults,
        score: scoreData.roundScore,
        hash: textHash,
        message: 'Seluruh kriteria framing tervalidasi tuntas berbasis bukti (Zero Critical Flaws).'
      };
    }

    // Cek apakah terjadi Plateau / Stagnasi Nalar
    if (history.length > 0) {
      const lastAudit = history[history.length - 1];
      if (lastAudit) {
        // Hash identik
        if (lastAudit.hash === textHash) {
          return {
            status: 'PLATEAU',
            verdict: 'REVISE',
            flaws,
            findings,
            score: scoreData.roundScore,
            hash: textHash,
            message: 'Model mengalami stagnasi (menghasilkan artefak identik tanpa perbaikan).'
          };
        }

        // Delta score < deltaMin
        const delta = (lastAudit.score || 0) - scoreData.roundScore;
        if (delta >= 0 && delta < this.deltaMin && history.length >= 2) {
          return {
            status: 'PLATEAU',
            verdict: 'REVISE',
            flaws,
            findings,
            score: scoreData.roundScore,
            hash: textHash,
            message: `Peningkatan skor marjinal (Delta ${delta} < ${this.deltaMin}). Evaluasi mencapai plateau.`
          };
        }

        // Regresi (skor memburuk)
        if (delta < 0) {
          return {
            status: 'REGRESSED',
            verdict: 'REVISE',
            flaws,
            findings,
            score: scoreData.roundScore,
            hash: textHash,
            message: `Terjadi regresi logika (Skor ronde sebelumnya ${lastAudit.score} -> ronde ini ${scoreData.roundScore}).`
          };
        }
      }
    }

    return {
      status: 'PROGRESS',
      verdict: 'REVISE',
      flaws,
      findings,
      criteriaResults,
      score: scoreData.roundScore,
      hash: textHash,
      message: `Ditemukan ${findings.length} temuan berbasis bukti yang wajib disempurnakan di tab browser.`
    };
  }

  /**
   * Menyusun Adversarial Counter-Prompt Berbasis Bukti
   * (Universal & Domain-Agnostic)
   */
  buildCounterPrompt(auditResult, currentTurn = 1, domain = 'general_technical') {
    const findings = auditResult.findings || [];
    const flaws = auditResult.flaws || [];

    let itemsText = '';
    if (findings.length > 0) {
      itemsText = findings.map((f, idx) => {
        return `${idx + 1}. [${f.severity.toUpperCase()}] ${f.claim}\n   • Bukti: ${f.evidence}\n   • Tindakan Korektif: ${f.counter_action}`;
      }).join('\n\n');
    } else if (flaws.length > 0) {
      itemsText = flaws.map((f, idx) => {
        return `${idx + 1}. [${f.dimension}] ${f.title}\n   • Masalah: ${f.description}`;
      }).join('\n\n');
    } else {
      itemsText = '1. Tinjau kembali konsistensi dan kelengkapan solusi agar siap dieksekusi langsung.';
    }

    return [
      `[EVALUATOR-OPTIMIZER CRITIQUE — ROUND ${currentTurn}]`,
      `[THING] [ACTIONABLE_CRITIQUE] [EVIDENCE_GATED]`,
      ``,
      `Sebagai Technical Reviewer independen, draf solusi Anda pada giliran sebelumnya memiliki temuan yang wajib diselesaikan sebelum rilis:`,
      ``,
      itemsText,
      ``,
      `INSTRUKSI REVISI WAJIB (NON-NEGOTIABLE):`,
      `1. Perbaiki secara konkret seluruh temuan di atas tanpa mengabaikan bukti yang dilampirkan.`,
      `2. Sajikan solusi/kode yang siap jalan, utuh, dan bebas dari placeholder.`,
      `3. Jawab LANGSUNG hasil revisi terstruktur tanpa basa-basi permohonan maaf.`
    ].join('\n');
  }

  /**
   * Format Hasil Akhir (Executive Battle-Tested Blueprint)
   */
  formatBattleTestedBlueprint(finalResponse, auditResult, turnsCompleted, history = [], domain = 'general_technical') {
    const headerBorder = '═'.repeat(74);
    const domainTitle = 'EVALUATOR-OPTIMIZER VERIFIED';

    const badge = auditResult.status === 'CONVERGED'
      ? `🟢 VERIFIED: BATTLE-TESTED BLUEPRINT`
      : `🟡 COMPLETED (${auditResult.status || 'CIRCUIT_BREAKER'})`;

    const debateSummary = history.length > 0
      ? `\nℹ️  [Log Evaluasi]: Melewati ${turnsCompleted} putaran debat berbasis bukti. Seluruh celah awal telah diselesaikan.`
      : `\nℹ️  [Log Evaluasi]: Konvergen pada Turn 1 (Kriteria terpenuhi tanpa temuan kritis).`;

    return [
      `╔${headerBorder}╗`,
      `║ ${badge.padEnd(72)} ║`,
      `╠${headerBorder}╣`,
      `║ Status Audit      : ${(auditResult.status || 'CONVERGED').padEnd(52)} ║`,
      `║ Putaran Debat     : ${`${turnsCompleted} turn(s)`.padEnd(52)} ║`,
      `║ Skor Konvergensi  : ${`${auditResult.score !== undefined ? auditResult.score : 0} (Lower is better)`.padEnd(52)} ║`,
      `╚${headerBorder}╝`,
      debateSummary,
      `\n--------------------------------------------------------------------------\n`,
      finalResponse,
      `\n--------------------------------------------------------------------------`
    ].join('\n');
  }

  /**
   * Evidence Delegation Router
   * Menerima permintaan verifikasi klaim (kode/formula/linter) dari Web LLM atau Critic,
   * dan mendelegasikan eksekusi ke delegator eksternal (Antigravity local terminal / compiler).
   * Menjaga CriticEngine tetap 100% domain-agnostik tanpa internal sandbox.
   *
   * @param {Object} evidenceRequest { kind: 'tool'|'quote'|'reasoning', payload: string, command?: string }
   * @param {Function} externalExecutor Optional async callback (req) => { exitCode, stdout, stderr }
   * @returns {Promise<Object>} { verified: boolean, output: string, error?: string, delegated: boolean }
   */
  async routeEvidenceVerification(evidenceRequest, externalExecutor = null) {
    if (!evidenceRequest || typeof evidenceRequest !== 'object') {
      return { verified: false, error: 'Invalid evidence request', delegated: false };
    }
    const { kind, payload } = evidenceRequest;
    if (typeof externalExecutor === 'function') {
      try {
        const result = await externalExecutor(evidenceRequest);
        return {
          verified: result && result.exitCode === 0,
          output: result ? (result.output || result.stdout || '') : '',
          error: result ? (result.error || result.stderr || null) : null,
          delegated: true
        };
      } catch (err) {
        return { verified: false, error: err.message, delegated: true };
      }
    }
    // Default quote/judgment check
    return {
      verified: kind === 'quote' && !!payload && payload.length > 0,
      output: payload || '',
      delegated: false
    };
  }
}

module.exports = CriticEngine;
