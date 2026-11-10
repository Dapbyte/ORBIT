/**
 * Unit Test untuk CriticEngine (Evaluator-Optimizer Dynamic Engine v2.0)
 */

const assert = require('assert');
const CriticEngine = require('../src/critic_engine');

console.log('🧪 Memulai pengujian CriticEngine (Domain-Agnostic Evaluator-Optimizer)...');

const engine = new CriticEngine();

// 1. Uji Dynamic Framing Generation
{
  const framing = engine.buildDefaultFraming('Optimize query latency in PostgreSQL indexing', { risk_tier: 2 });
  assert.strictEqual(framing.risk_tier, 2);
  assert.ok(framing.criteria.length >= 3, 'Harus memuat minimal 3 kriteria baseline (U1, U2, U3)');
  assert.ok(framing.criteria.some(c => c.id === 'U1'));
  console.log('  ✔ buildDefaultFraming: Dynamic framing baseline sukses');
}

// 2. Uji Deterministic Scoring
{
  const findings = [
    { severity: 'blocker', status: 'new' }, // 8
    { severity: 'major', status: 'new' },   // 3
    { severity: 'minor', status: 'new' },   // 1
    { severity: 'major', status: 'resolved' } // 0 (resolved)
  ];
  const criteriaResults = [
    { criterion_id: 'U1', status: 'unmet' }, // 5 * 1 = 5
    { criterion_id: 'U2', status: 'met' }
  ];
  const localErrors = 1; // 8 * 1 = 8

  // Total Score = 8 + 3 + 1 + 5 + 8 = 25
  const scoreData = engine.calculateRoundScore(findings, criteriaResults, localErrors);
  assert.strictEqual(scoreData.roundScore, 25, 'Skor ronde harus tepat 25');
  assert.strictEqual(scoreData.blockerCount, 2, 'Harus mendeteksi 2 blocker/major terbuka');
  console.log('  ✔ calculateRoundScore: Perhitungan skor deterministik anti-sycophancy sukses');
}

// 3. Uji Deteksi Celah (Placeholder & Silent Error)
{
  const badResponse = `
    Berikut implementasi caching Redis:
    async function getCachedUser(id) {
      try {
        // TODO: implement logic here
      } catch (err) {}
    }
  `;

  const audit = engine.scrutinize(badResponse);
  assert.strictEqual(audit.verdict, 'REVISE', 'Status harus REVISE karena ada placeholder');
  assert.ok(audit.findings.some(f => f.criterion_id === 'U3'), 'Harus mendeteksi kriteria U3 dilanggar');
  assert.ok(audit.findings.some(f => f.claim.includes('placeholder')), 'Harus mendeteksi klaim placeholder');
  assert.ok(audit.score > 0, 'Skor harus > 0');
  console.log('  ✔ scrutinize: Deteksi temuan berbasis bukti (placeholder & silent catch) sukses');

  // Uji Pembuatan Counter-Prompt Berbasis Bukti
  const counterPrompt = engine.buildCounterPrompt(audit, 1);
  assert.ok(counterPrompt.includes('ACTIONABLE_CRITIQUE'), 'Harus memuat header ACTIONABLE_CRITIQUE');
  assert.ok(counterPrompt.includes('Bukti:'), 'Harus menyertakan bukti konkret');
  assert.ok(!counterPrompt.includes('flume box'), 'Tidak boleh memuat flume box!');
  assert.ok(!counterPrompt.includes('MPU6050'), 'Tidak boleh memuat MPU6050!');
  console.log('  ✔ buildCounterPrompt: Pembuatan counter prompt berbasis bukti sukses');
}

// 4. Uji Konvergensi (Clean Response)
{
  const cleanResponse = `
    Berikut implementasi caching Redis yang siap eksekusi:
    import { Redis } from 'ioredis';
    export async function getCachedUser(redis: Redis, id: string): Promise<User | null> {
      const data = await redis.get(\`user:\${id}\`);
      if (!data) return null;
      return JSON.parse(data);
    }
  `;

  const audit = engine.scrutinize(cleanResponse);
  assert.strictEqual(audit.status, 'CONVERGED', 'Status harus CONVERGED');
  assert.strictEqual(audit.verdict, 'PASS', 'Verdict harus PASS');
  assert.strictEqual(audit.score, 0, 'Skor konvergen harus 0');
  console.log('  ✔ scrutinize: Konvergensi pada respon bersih sukses');

  // Blueprint Formatter
  const blueprint = engine.formatBattleTestedBlueprint(cleanResponse, audit, 1);
  assert.ok(blueprint.includes('VERIFIED: BATTLE-TESTED'), 'Harus memuat badge terverifikasi');
  console.log('  ✔ formatBattleTestedBlueprint: Format blueprint final sukses');
}

// 5. Uji Deteksi Plateau (Hash Identik)
{
  const stagnantResponse = 'function doSomething() { // TODO: fix }';
  const audit1 = engine.scrutinize(stagnantResponse, []);
  const audit2 = engine.scrutinize(stagnantResponse, [audit1]);
  assert.strictEqual(audit2.status, 'PLATEAU', 'Status harus PLATEAU saat artefak identik');
  console.log('  ✔ evaluateConvergence: Deteksi plateau artefak identik sukses');
}

// 6. Uji Deteksi Blocker (Source Files Required)
{
  const blockerResponse = `
    [BLUESENTINEL] [AUDIT] [SOURCE FILES UNAVAILABLE]
    BLOCKER: Isi repositori belum tersedia dalam sesi ini.
    Harap lampirkan package.json.
  `;
  const audit = engine.scrutinize(blockerResponse);
  assert.strictEqual(audit.status, 'BLOCKED', 'Harus mendeteksi status BLOCKED');
  assert.strictEqual(audit.verdict, 'BLOCKED');
  console.log('  ✔ blockerHandling: Deteksi status BLOCKED saat file sumber belum ada sukses');
}

console.log('✅ Unit test critic_engine.test.js: BERHASIL (100% Passed)!');
