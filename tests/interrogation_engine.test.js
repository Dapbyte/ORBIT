/**
 * Unit Test untuk InterrogationEngine (Backward-Compatibility Bridge ke CriticEngine)
 */

const assert = require('assert');
const InterrogationEngine = require('../src/interrogation_engine');
const CriticEngine = require('../src/critic_engine');

console.log('🧪 Memulai pengujian InterrogationEngine (Legacy Bridge ke CriticEngine)...');

const engine = new InterrogationEngine();

// 1. Uji Pewarisan dan Kompatibilitas Kelas
{
  assert.ok(engine instanceof CriticEngine, 'InterrogationEngine harus mewarisi CriticEngine');
  console.log('  ✔ inheritance: InterrogationEngine merupakan subclass CriticEngine');
}

// 2. Uji Deteksi Celah Berbasis Bukti (Placeholder & Silent Error)
{
  const badResponse = `
    Rancangan Sistem Autentikasi:
    async function verifyToken(jwt) {
      try {
        // TODO: implement validation logic later
      } catch (e) {}
    }
  `;

  const audit = engine.scrutinize(badResponse);
  assert.strictEqual(audit.verdict, 'REVISE', 'Status harus REVISE karena ada celah');
  assert.ok(audit.findings.some(f => f.criterion_id === 'U3'), 'Harus mendeteksi placeholder');
  assert.ok(audit.findings.some(f => f.criterion_id === 'U2'), 'Harus mendeteksi silent error');
  console.log('  ✔ scrutinize: Deteksi celah berbasis bukti sukses');

  // Uji Pembuatan Counter-Prompt Berbasis Bukti
  const counterPrompt = engine.buildCounterPrompt(audit, 1, 'general_technical');
  assert.ok(counterPrompt.includes('EVALUATOR-OPTIMIZER CRITIQUE'), 'Harus memuat header EVALUATOR-OPTIMIZER CRITIQUE');
  assert.ok(counterPrompt.includes('placeholder'), 'Harus menyebutkan temuan placeholder');
  console.log('  ✔ buildCounterPrompt: Pembuatan prompt sanggahan sukses');
}

// 3. Uji Konvergensi (Clean & Battle-Tested Response)
{
  const goodResponse = `
    Rancangan Sistem Token Verifier:
    Implementasi tuntas menggunakan HMAC-SHA256 dengan constant-time comparison.
    Semua parameter diverifikasi terhadap schema kontrak DTO dan logging error eksplisit.
  `;

  const audit = engine.scrutinize(goodResponse);
  assert.strictEqual(audit.status, 'CONVERGED', 'Status harus CONVERGED');
  assert.strictEqual(audit.verdict, 'PASS', 'Verdict harus PASS');
  assert.strictEqual(audit.score, 0, 'Skor harus 0 (Zero Critical Flaws)');
  console.log('  ✔ scrutinize: Deteksi status CONVERGED sukses');

  // Uji Formatter Blueprint
  const blueprint = engine.formatBattleTestedBlueprint(goodResponse, audit, 2, [], 'general_technical');
  assert.ok(blueprint.includes('VERIFIED: BATTLE-TESTED BLUEPRINT'), 'Harus memiliki badge verifikasi');
  assert.ok(blueprint.includes('Status Audit'), 'Harus mencantumkan status audit');
  console.log('  ✔ formatBattleTestedBlueprint: Format blueprint final sukses');
}

// 4. Uji Blocker Handling (Ketergantungan Berkas Sumber)
{
  const blockedResponse = 'BLOCKER: Source files unavailable. Harap lampirkan file schema.prisma.';
  const audit = engine.scrutinize(blockedResponse);
  assert.strictEqual(audit.status, 'BLOCKED', 'Harus mendeteksi status BLOCKED');
  console.log('  ✔ blockerHandling: Deteksi status BLOCKED sukses');
}

console.log('✅ Unit test interrogation_engine.test.js: BERHASIL (100% Passed)!');
