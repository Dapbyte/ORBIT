const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SessionHistory = require('../src/session_history');

const TEST_STATE_FILE = path.join(__dirname, 'test_session_state.json');

function testSessionHistory() {
  if (fs.existsSync(TEST_STATE_FILE)) fs.unlinkSync(TEST_STATE_FILE);

  const history = new SessionHistory(TEST_STATE_FILE);
  assert.strictEqual(history.getTurns().length, 0, 'Harus kosong saat inisialisasi');

  // Giliran 1: User tanya formula
  history.addTurn('user', 'Tolong perbaiki Formula (3) di paper.');
  history.addTurn('assistant', 'Berikut perbaikan Formula (3): X = Y + Z.', 'claude');

  assert.strictEqual(history.getTurns().length, 2, 'Harus mencatat 2 giliran');

  // Buat Handoff Bundle saat failover
  const pendingTask = 'Sekarang tambahkan notasi baseline evaluasinya.';
  const bundle = history.buildHandoffBundle(pendingTask);

  assert(bundle.includes('Sesi percakapan ini dialihkan dari Claude'), 'Bundle harus memuat informasi pengalihan');
  assert(bundle.includes('Formula (3)'), 'Bundle harus berisi riwayat percakapan sebelumnya');
  assert(bundle.includes(pendingTask), 'Bundle harus memuat tugas lanjutan saat ini');

  // Test load ulang dari file
  const historyReloaded = new SessionHistory(TEST_STATE_FILE);
  assert.strictEqual(historyReloaded.getTurns().length, 2, 'Harus persisten saat reload');

  // Bersihkan file test
  fs.unlinkSync(TEST_STATE_FILE);
  console.log('✅ Unit test session_history.test.js: BERHASIL (100% Passed)!');
}

testSessionHistory();
