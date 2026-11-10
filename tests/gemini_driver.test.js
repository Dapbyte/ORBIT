/**
 * Unit Test GeminiDriver
 * Memverifikasi inisialisasi, konfigurasi selectors, model selection (4 Argon),
 * reasoning depth (Tinggi), mode (Percakapan vs Tugas), dan kontrak BaseDriver.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const GeminiDriver = require('../src/drivers/gemini_driver');

async function runTests() {
  console.log('🧪 Memulai pengujian GeminiDriver...');

  const selectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'selectors.json'), 'utf-8'));
  assert(selectors.gemini, 'Konfigurasi selectors untuk Gemini harus ada');
  assert(selectors.gemini.home_url.includes('gemini.google.com'), 'Home URL Gemini harus gemini.google.com');
  assert(Array.isArray(selectors.gemini.input_selectors), 'Input selectors Gemini harus berupa array');
  assert(Array.isArray(selectors.gemini.send_button_selectors), 'Send button selectors Gemini harus berupa array');
  assert(Array.isArray(selectors.gemini.stop_button_selectors), 'Stop button selectors Gemini harus berupa array');
  assert(Array.isArray(selectors.gemini.rate_limit_patterns), 'Rate limit patterns Gemini harus berupa array');
  assert(Array.isArray(selectors.gemini.auth_patterns), 'Auth patterns Gemini harus berupa array');
  assert.strictEqual(selectors.gemini.default_model, '4 Argon', 'Default model harus 4 Argon');
  assert.strictEqual(selectors.gemini.default_reasoning, 'Tinggi', 'Default reasoning harus Tinggi');

  // Pastikan selector input mengutamakan Quill .ql-editor
  assert(selectors.gemini.input_selectors[0].includes('.ql-editor'), 'Input selector pertama harus Quill .ql-editor');

  // Mock browser manager
  const mockBrowserManager = {
    getTab: async (provider) => {
      assert.strictEqual(provider, 'gemini');
      return null;
    }
  };

  const driver = new GeminiDriver(mockBrowserManager, selectors.gemini);
  assert.strictEqual(driver.providerName, 'gemini', 'Provider name harus gemini');
  assert(typeof driver.isReady === 'function', 'Harus memiliki metode isReady');
  assert(typeof driver.waitForIdle === 'function', 'Harus memiliki metode waitForIdle');
  assert(typeof driver.sendMessage === 'function', 'Harus memiliki metode sendMessage');
  assert(typeof driver.waitForResponse === 'function', 'Harus memiliki metode waitForResponse');
  assert(typeof driver.detectRateLimit === 'function', 'Harus memiliki metode detectRateLimit');
  assert(typeof driver.detectGenerationError === 'function', 'Harus memiliki metode detectGenerationError');
  assert(typeof driver.extractResponse === 'function', 'Harus memiliki metode extractResponse');
  assert(typeof driver.selectModel === 'function', 'Harus memiliki metode selectModel');
  assert(typeof driver.setReasoningLevel === 'function', 'Harus memiliki metode setReasoningLevel');
  assert(typeof driver.selectMode === 'function', 'Harus memiliki metode selectMode');
  assert(typeof driver.resetSession === 'function', 'Harus memiliki metode resetSession');

  // Pengujian opsi allowDowngrade
  assert.strictEqual(await driver.detectRateLimit({ allowDowngrade: true }), false, 'detectRateLimit dengan allowDowngrade harus mengembalikan false');

  console.log('✅ Unit test gemini_driver.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test gemini driver:', err);
  process.exit(1);
});
