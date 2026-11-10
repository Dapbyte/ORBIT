/**
 * Unit Test QwenDriver
 * Memverifikasi inisialisasi, konfigurasi selectors, dan kontrak driver Qwen.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const QwenDriver = require('../src/drivers/qwen_driver');

async function runTests() {
  console.log('🧪 Memulai pengujian QwenDriver...');

  const selectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'selectors.json'), 'utf-8'));
  assert(selectors.qwen, 'Konfigurasi selectors untuk Qwen harus ada');
  assert(selectors.qwen.home_url.includes('chat.qwen.ai'), 'Home URL Qwen harus chat.qwen.ai');
  assert(Array.isArray(selectors.qwen.input_selectors), 'Input selectors Qwen harus berupa array');
  assert(Array.isArray(selectors.qwen.rate_limit_patterns), 'Rate limit patterns Qwen harus berupa array');
  assert(Array.isArray(selectors.qwen.auth_patterns), 'Auth patterns Qwen harus berupa array');

  // Mock browser manager
  const mockBrowserManager = {
    getTab: async (provider) => {
      assert.strictEqual(provider, 'qwen');
      return null;
    }
  };

  const driver = new QwenDriver(mockBrowserManager, selectors.qwen);
  assert.strictEqual(driver.providerName, 'qwen', 'Provider name harus qwen');
  assert(typeof driver.isReady === 'function', 'Harus memiliki metode isReady');
  assert(typeof driver.sendMessage === 'function', 'Harus memiliki metode sendMessage');
  assert(typeof driver.waitForResponse === 'function', 'Harus memiliki metode waitForResponse');
  assert(typeof driver.detectRateLimit === 'function', 'Harus memiliki metode detectRateLimit');
  assert(typeof driver.extractResponse === 'function', 'Harus memiliki metode extractResponse');
  assert(typeof driver.detectAuthRequired === 'function', 'Harus memiliki metode detectAuthRequired');

  console.log('✅ Unit test qwen_driver.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test qwen driver:', err);
  process.exit(1);
});
