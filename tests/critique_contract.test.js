/**
 * Unit Test untuk Universal Critique Contract (Schema v1.0)
 */

const assert = require('assert');
const {
  validateFraming,
  validateCritique
} = require('../src/contracts/critique_contract');

console.log('🧪 Memulai pengujian CritiqueContract (Schema v1.0)...');

// 1. Uji Valid Framing
{
  const validFraming = {
    task_summary: 'Refactor simulation gateway WebSocket to handle cadet connection without dropping',
    risk_tier: 2,
    criteria: [
      { id: 'C1', statement: 'Non-blocking cadet room fallback', required: true, verifier: { kind: 'judgment' } },
      { id: 'C2', statement: 'TypeScript typecheck exit 0', required: true, verifier: { kind: 'executable', command_id: 'typecheck' } }
    ]
  };

  const res = validateFraming(validFraming);
  assert.strictEqual(res.ok, true, 'Framing valid harus lulus validasi');
  assert.strictEqual(res.errors.length, 0);
  console.log('  ✔ validateFraming: Valid framing sukses');
}

// 2. Uji Invalid Framing
{
  const badFraming = {
    task_summary: '', // Kosong
    risk_tier: 99,    // Invalid tier
    criteria: []      // Kosong
  };

  const res = validateFraming(badFraming);
  assert.strictEqual(res.ok, false, 'Framing tidak valid harus gagal');
  assert.ok(res.errors.length >= 3, 'Harus mendeteksi minimal 3 kesalahan framing');
  console.log('  ✔ validateFraming: Deteksi framing cacat sukses');
}

// 3. Uji Valid Critique
{
  const framing = {
    task_summary: 'Implement secure JWT verification',
    risk_tier: 2,
    criteria: [
      { id: 'C1', statement: 'Verify token expiration and signature', required: true, verifier: { kind: 'executable', command_id: 'test' } }
    ]
  };

  const validCritique = {
    schema_version: '1.0',
    round: 1,
    verdict: 'REVISE',
    criteria_results: [
      { criterion_id: 'C1', status: 'unmet', evidence: 'Token expired check is missing in verifyToken()', evidence_kind: 'quote' }
    ],
    findings: [
      {
        id: 'F1',
        severity: 'major',
        status: 'new',
        criterion_id: 'C1',
        claim: 'Missing exp claim validation',
        evidence: 'verifyToken implementation does not inspect payload.exp',
        evidence_kind: 'quote',
        counter_action: 'Add expiration check or pass verifyOptions.ignoreExpiration: false',
        confidence: 0.95
      }
    ],
    blocked: null,
    unverified_assumptions: []
  };

  const res = validateCritique(validCritique, framing, []);
  assert.strictEqual(res.ok, true, 'Critique valid harus lulus validasi');
  console.log('  ✔ validateCritique: Valid critique dengan findings berbasis bukti sukses');
}

// 4. Uji Penolakan Out-of-Scope Finding (Pencegahan Bug Flume Box!)
{
  const framing = {
    task_summary: 'Refactor UI button styling',
    risk_tier: 1,
    criteria: [
      { id: 'C1', statement: 'Button contrast ratio >= 4.5:1', required: true, verifier: { kind: 'inspectable' } }
    ]
  };

  const hallucinatedCritique = {
    schema_version: '1.0',
    round: 1,
    verdict: 'REVISE',
    criteria_results: [
      { criterion_id: 'C1', status: 'met', evidence: 'Contrast is 6.2:1', evidence_kind: 'tool' }
    ],
    findings: [
      {
        id: 'F1',
        severity: 'blocker',
        status: 'new',
        criterion_id: 'NON_EXISTENT_FLUME_BOX', // Celah di luar kriteria framing!
        claim: 'Ketiadaan meja uji flume box bencana alam',
        evidence: 'Text lacks flume box',
        evidence_kind: 'reasoning',
        counter_action: 'Build flume box',
        confidence: 0.9
      }
    ],
    blocked: null
  };

  const res = validateCritique(hallucinatedCritique, framing, []);
  assert.strictEqual(res.ok, false, 'Critique dengan kriteria di luar framing HARUS DITOLAK');
  assert.ok(res.errors.some(e => e.includes('out of framing')), 'Harus menangkap error out of framing');
  console.log('  ✔ validateCritique: Penolakan kritik halusinasi di luar framing (anti-flume-box) sukses');
}

// 5. Uji Penolakan Kritik Tanpa Bukti (Evidence-Gated Rule)
{
  const framing = {
    task_summary: 'Task A',
    risk_tier: 1,
    criteria: [
      { id: 'C1', statement: 'Statement 1', required: true, verifier: { kind: 'inspectable' } }
    ]
  };

  const noEvidenceCritique = {
    schema_version: '1.0',
    round: 1,
    verdict: 'REVISE',
    criteria_results: [
      { criterion_id: 'C1', status: 'unmet', evidence: 'Unmet', evidence_kind: 'quote' }
    ],
    findings: [
      {
        id: 'F1',
        severity: 'major',
        status: 'new',
        criterion_id: 'C1',
        claim: 'Code looks bad',
        evidence: '', // KOSONG - Tanpa bukti nyata
        evidence_kind: 'quote',
        counter_action: 'Fix it',
        confidence: 0.5
      }
    ],
    blocked: null
  };

  const res = validateCritique(noEvidenceCritique, framing, []);
  assert.strictEqual(res.ok, false, 'Finding tanpa bukti konkret harus ditolak');
  assert.ok(res.errors.some(e => e.includes('evidence required')), 'Harus menuntut evidence');
  console.log('  ✔ validateCritique: Penolakan temuan tanpa bukti sukses');
}

console.log('✅ Unit test critique_contract.test.js: BERHASIL (100% Passed)!');
