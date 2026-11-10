/**
 * Unit Test ClaudeDriver
 * Memverifikasi inisialisasi, konfigurasi selectors, Pre-Send Guard, Post-Send Verification,
 * deteksi error generasi, dan kontrak driver Claude.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ClaudeDriver = require('../src/drivers/claude_driver');

async function runTests() {
  console.log('🧪 Memulai pengujian ClaudeDriver...');

  const selectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'selectors.json'), 'utf-8'));
  assert(selectors.claude, 'Konfigurasi selectors untuk Claude harus ada');
  assert(selectors.claude.home_url.includes('claude.ai'), 'Home URL Claude harus claude.ai');
  assert(Array.isArray(selectors.claude.input_selectors), 'Input selectors Claude harus berupa array');
  assert(Array.isArray(selectors.claude.send_button_selectors), 'Send button selectors Claude harus berupa array');
  assert(Array.isArray(selectors.claude.stop_button_selectors), 'Stop button selectors Claude harus berupa array');
  assert(Array.isArray(selectors.claude.streaming_selectors), 'Streaming selectors Claude harus berupa array');
  assert(Array.isArray(selectors.claude.message_selectors), 'Message selectors Claude harus berupa array');
  assert(Array.isArray(selectors.claude.rate_limit_patterns), 'Rate limit patterns Claude harus berupa array');
  assert(Array.isArray(selectors.claude.generation_error_patterns), 'Generation error patterns Claude harus berupa array');
  assert(Array.isArray(selectors.claude.auth_patterns), 'Auth patterns Claude harus berupa array');

  // Pastikan generation_error_patterns memiliki pola-pola kritis
  const errPatterns = selectors.claude.generation_error_patterns;
  assert(errPatterns.includes('error generating response'), 'Harus mendeteksi error generating response');
  assert(errPatterns.includes('conversation is too long'), 'Harus mendeteksi conversation is too long');

  // Mock page untuk pengujian fungsionalitas driver
  const mockPage = {
    evaluate: async (fn, ...args) => {
      // Mock evaluate handler
      if (fn.toString().includes('document.querySelector')) {
        return true;
      }
      return false;
    },
    $: async (sel) => null,
    keyboard: {
      press: async () => {}
    },
    reload: async () => {}
  };

  // Mock browser manager
  const mockBrowserManager = {
    getTab: async (provider) => {
      assert.strictEqual(provider, 'claude');
      return mockPage;
    }
  };

  const driver = new ClaudeDriver(mockBrowserManager, selectors.claude);
  assert.strictEqual(driver.providerName, 'claude', 'Provider name harus claude');
  assert(typeof driver.isReady === 'function', 'Harus memiliki metode isReady');
  assert(typeof driver.waitForIdle === 'function', 'Harus memiliki metode waitForIdle');
  assert(typeof driver.sendMessage === 'function', 'Harus memiliki metode sendMessage');
  assert(typeof driver.waitForResponse === 'function', 'Harus memiliki metode waitForResponse');
  assert(typeof driver.detectRateLimit === 'function', 'Harus memiliki metode detectRateLimit');
  assert(typeof driver.detectGenerationError === 'function', 'Harus memiliki metode detectGenerationError');
  assert(typeof driver.extractResponse === 'function', 'Harus memiliki metode extractResponse');

  // Test detectGenerationError mock logic
  mockPage.evaluate = async (fn, patterns) => {
    return { hasError: true, pattern: 'claude had an error' };
  };
  const errorDetection = await driver.detectGenerationError();
  assert.strictEqual(errorDetection.hasError, true, 'detectGenerationError harus mengembalikan true saat error terdeteksi');
  assert.strictEqual(errorDetection.pattern, 'claude had an error', 'Pola error harus sesuai');

  // Test detectGenerationError mock logic ketika normal
  mockPage.evaluate = async (fn, patterns) => {
    return { hasError: false };
  };
  const normalDetection = await driver.detectGenerationError();
  assert.strictEqual(normalDetection.hasError, false, 'detectGenerationError harus false jika tidak ada error');

  // Test waitForIdle mock logic
  mockPage.evaluate = async (fn, stopSelectors) => {
    return false; // isBusy = false
  };
  const idleStatus = await driver.waitForIdle(2000);
  assert.strictEqual(idleStatus, true, 'waitForIdle harus mengembalikan true jika tidak busy');

  // Test sendMessage skill activation mock logic (/caveman on initial turn only)
  let typedKeys = [];
  mockPage.url = () => 'https://claude.ai/new';
  mockPage.keyboard = {
    type: async (text) => { typedKeys.push(text); },
    press: async (key) => { typedKeys.push(key); }
  };
  mockPage.evaluate = async (fn, ...args) => {
    const fnStr = fn.toString();
    if (fnStr.includes('isBusy') || fnStr.includes('stopSelectors')) {
      return false; // Not busy
    }
    if (fnStr.includes('offsetParent') || fnStr.includes('inputSelectors')) {
      return true; // Input element is ready
    }
    if (fnStr.includes('disabled') || fnStr.includes('offsetWidth')) {
      return true; // Send button is usable
    }
    if (fnStr.includes('textRemaining')) {
      return { textRemaining: false, stopActive: true };
    }
    if (fnStr.includes('alerts')) {
      return { isLimited: false };
    }
    if (fnStr.includes('count')) {
      return 0;
    }
    return false;
  };
  mockPage.$ = async (sel) => ({
    click: async () => {},
    focus: async () => {}
  });

  // Giliran 1: Sesi chat awal (harus mengetik /caveman)
  typedKeys = [];
  await driver.sendMessage('Halo dunia', { isInitialTurn: true });
  assert(typedKeys.includes('/caveman'), 'Harus mengetik /caveman saat isInitialTurn true');
  assert(typedKeys.includes('Enter'), 'Harus menekan Enter untuk konfirmasi skill chip');

  // Giliran 2: Sesi lanjutan (tidak boleh mengetik /caveman)
  typedKeys = [];
  mockPage.url = () => 'https://claude.ai/chat/1234';
  await driver.sendMessage('Pertanyaan lanjutan', { isInitialTurn: false });
  assert(!typedKeys.includes('/caveman'), 'Tidak boleh mengetik /caveman pada giliran lanjutan');

  // Giliran 3: Tab berada di https://claude.ai/new meskipun options.isInitialTurn false (stale history)
  typedKeys = [];
  mockPage.url = () => 'https://claude.ai/new';
  await driver.sendMessage('Pertanyaan baru di tab baru', { isInitialTurn: false });
  assert(typedKeys.includes('/caveman'), 'Harus tetap mengetik /caveman saat tab berada di URL /new');

  console.log('✅ Unit test claude_driver.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test claude driver:', err);
  process.exit(1);
});
