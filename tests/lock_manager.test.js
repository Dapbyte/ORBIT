const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const LockManager = require('../src/lock_manager');

async function runTests() {
  const testLockDir = path.join(os.tmpdir(), 'web-llm-orchestrator-test-locks-' + Date.now());
  const lm = new LockManager(testLockDir);

  console.log('🧪 Memulai pengujian LockManager...');

  // 1. Acquire dan Release normal
  assert.strictEqual(lm.tryAcquire('test_resource'), true, 'Harus berhasil acquire lock pertama kali');
  assert.strictEqual(lm.tryAcquire('test_resource'), false, 'Tidak boleh acquire lock yang sama dua kali');
  assert.strictEqual(lm.release('test_resource'), true, 'Harus berhasil release lock');
  assert.strictEqual(lm.tryAcquire('test_resource'), true, 'Harus bisa acquire kembali setelah di-release');
  lm.release('test_resource');

  // 2. Stale Lock karena TTL kadaluarsa
  const lockFile = lm.getLockFilePath('expired_resource');
  const expiredPayload = {
    pid: process.pid,
    resource: 'expired_resource',
    timestamp: Date.now() - 200000, // 200 detik lalu
    ttl: 60000 // 60 detik TTL
  };
  fs.writeFileSync(lockFile, JSON.stringify(expiredPayload));

  assert.strictEqual(lm.tryAcquire('expired_resource', 60000), true, 'Harus berhasil acquire jika lock sebelumnya sudah expired');
  lm.release('expired_resource');

  // 3. Stale Lock karena PID mati
  const fakeDeadPid = 9999999;
  const deadPayload = {
    pid: fakeDeadPid,
    resource: 'dead_proc_resource',
    timestamp: Date.now(),
    ttl: 300000
  };
  fs.writeFileSync(lm.getLockFilePath('dead_proc_resource'), JSON.stringify(deadPayload));

  assert.strictEqual(lm.tryAcquire('dead_proc_resource'), true, 'Harus berhasil bersihkan lock dari proses yang mati');
  lm.release('dead_proc_resource');

  // 4. Test acquire async dengan timeout
  let acquired = await lm.acquire('async_resource', 2000);
  assert.strictEqual(acquired, true, 'Acquire async berhasil');
  lm.release('async_resource');

  // 5. Test Fencing Token
  lm.tryAcquire('token_resource');
  const token = lm.getToken('token_resource');
  assert.ok(typeof token === 'string' && token.length > 0, 'Token harus berupa UUID valid');
  assert.strictEqual(lm.release('token_resource', 'wrong-token-1234'), false, 'Tidak boleh release dengan token yang salah');
  assert.strictEqual(lm.release('token_resource', token), true, 'Harus berhasil release dengan token yang sah');

  // 6. Test withLock wrapper
  const result = await lm.withLock('scoped_resource', async (tok) => {
    assert.ok(typeof tok === 'string', 'withLock harus menyediakan fencing token');
    assert.strictEqual(lm.tryAcquire('scoped_resource'), false, 'Lock harus sedang dipegang di dalam callback');
    return 'computed_result';
  });
  assert.strictEqual(result, 'computed_result', 'Hasil callback withLock harus dikembalikan');
  assert.strictEqual(lm.tryAcquire('scoped_resource'), true, 'Lock harus sudah otomatis dilepas setelah withLock');
  lm.release('scoped_resource');

  // 7. Test acquireMany (Multi-resource locking deterministik)
  const multiAcquired = await lm.acquireMany(['resource_b', 'resource_a']);
  assert.strictEqual(multiAcquired, true, 'acquireMany harus berhasil mendapatkan multi-resource');
  lm.release('resource_a');
  lm.release('resource_b');

  // 8. Test isProcessAlive
  assert.strictEqual(LockManager.isProcessAlive(process.pid), true, 'Proses saat ini harus aktif');
  assert.strictEqual(LockManager.isProcessAlive(fakeDeadPid), false, 'Fake PID harus terdeteksi mati');

  // Bersihkan folder test
  try {
    fs.rmSync(testLockDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('✅ Unit test lock_manager.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test lock_manager:', err);
  process.exit(1);
});
