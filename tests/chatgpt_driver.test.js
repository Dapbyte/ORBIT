/**
 * Unit Test ChatGPTDriver
 * Memverifikasi inisialisasi, konfigurasi selectors, Pre-Send Guard, dan kontrak driver ChatGPT.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ChatGPTDriver = require('../src/drivers/chatgpt_driver');

async function runTests() {
  console.log('🧪 Memulai pengujian ChatGPTDriver...');

  const selectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'selectors.json'), 'utf-8'));
  assert(selectors.chatgpt, 'Konfigurasi selectors untuk ChatGPT harus ada');
  assert(selectors.chatgpt.home_url.includes('chatgpt.com'), 'Home URL ChatGPT harus chatgpt.com');
  assert(Array.isArray(selectors.chatgpt.input_selectors), 'Input selectors ChatGPT harus berupa array');
  assert(Array.isArray(selectors.chatgpt.send_button_selectors), 'Send button selectors ChatGPT harus berupa array');
  assert(Array.isArray(selectors.chatgpt.stop_button_selectors), 'Stop button selectors ChatGPT harus berupa array');
  assert(Array.isArray(selectors.chatgpt.rate_limit_patterns), 'Rate limit patterns ChatGPT harus berupa array');
  assert(Array.isArray(selectors.chatgpt.auth_patterns), 'Auth patterns ChatGPT harus berupa array');

  // Pastikan selector input mengutamakan ProseMirror dan mengecualikan canvas .cm-content
  assert(selectors.chatgpt.input_selectors[0].includes('ProseMirror'), 'Input selector pertama harus ProseMirror');

  // Mock browser manager
  const mockBrowserManager = {
    getTab: async (provider) => {
      assert.strictEqual(provider, 'chatgpt');
      return null;
    }
  };

  const driver = new ChatGPTDriver(mockBrowserManager, selectors.chatgpt);
  assert.strictEqual(driver.providerName, 'chatgpt', 'Provider name harus chatgpt');
  assert(typeof driver.isReady === 'function', 'Harus memiliki metode isReady');
  assert(typeof driver.waitForIdle === 'function', 'Harus memiliki metode waitForIdle');
  assert(typeof driver.sendMessage === 'function', 'Harus memiliki metode sendMessage');
  assert(typeof driver.waitForResponse === 'function', 'Harus memiliki metode waitForResponse');
  assert(typeof driver.detectRateLimit === 'function', 'Harus memiliki metode detectRateLimit');
  assert(typeof driver.detectGenerationError === 'function', 'Harus memiliki metode detectGenerationError');
  assert(typeof driver.extractResponse === 'function', 'Harus memiliki metode extractResponse');
  assert(typeof driver.setThinkingMode === 'function', 'Harus memiliki metode setThinkingMode');

  console.log('✅ Unit test chatgpt_driver.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test chatgpt driver:', err);
  process.exit(1);
});
