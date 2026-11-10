const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CooldownStore } = require('../src/cooldown_store');

console.log('🧪 Memulai pengujian CooldownStore (Atomic Persistence)...');

const testFile = path.join(os.tmpdir(), `test_cooldown_${Date.now()}.json`);
const store = new CooldownStore(testFile);

try {
  // 1. Inisial get mengembalikan null
  assert.strictEqual(store.get('gemini'), null, 'Harus null saat belum diset');
  console.log('  ✔ Pembacaan inisial null sukses');

  // 2. Set record
  const resetAt = Date.now() + 1800000;
  store.set('gemini', {
    resetAt,
    source: 'text',
    rawText: 'Batas direset pada 14 Okt, 20.51'
  });

  const saved = store.get('gemini');
  assert(saved !== null, 'Record harus tersimpan');
  assert.strictEqual(saved.provider, 'gemini');
  assert.strictEqual(saved.resetAt, resetAt);
  assert.strictEqual(saved.rawText, 'Batas direset pada 14 Okt, 20.51');
  console.log('  ✔ Penyimpanan atomik record sukses');

  // 3. Clear single provider
  store.clear('gemini');
  assert.strictEqual(store.get('gemini'), null, 'Record harus terhapus');
  console.log('  ✔ Penghapusan single provider sukses');

  // 4. Clear all
  store.set('claude', { resetAt: Date.now() + 10000 });
  store.set('chatgpt', { resetAt: Date.now() + 20000 });
  store.clearAll();
  assert.strictEqual(store.get('claude'), null);
  assert.strictEqual(store.get('chatgpt'), null);
  console.log('  ✔ Clear all sukses');

  console.log('✅ Unit test cooldown_store.test.js: BERHASIL (100% Passed)!');
} finally {
  try {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    if (fs.existsSync(`${testFile}.lock`)) fs.unlinkSync(`${testFile}.lock`);
  } catch {}
}
