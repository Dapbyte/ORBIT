'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolvePrompt, readPromptFile, readInline, PromptInputError } = require('../src/prompt_input');

async function testPromptInput() {
  console.log('🧪 Memulai pengujian PromptInput (Shell Safety Guard)...');

  // 1. Valid short inline prompt
  const shortPrompt = readInline('Jelaskan microservices secara ringkas');
  assert.strictEqual(shortPrompt, 'Jelaskan microservices secara ringkas');
  console.log('  ✔ readInline: Prompt pendek 1 baris sukses diterima');

  // 2. Multi-line inline prompt rejected
  assert.throws(
    () => readInline('Baris 1\nBaris 2'),
    (err) => err instanceof PromptInputError && err.code === 'E_INLINE_UNSAFE'
  );
  console.log('  ✔ readInline: Prompt multi-baris ditolak (E_INLINE_UNSAFE)');

  // 3. Long inline prompt rejected
  const longPrompt = 'a'.repeat(301);
  assert.throws(
    () => readInline(longPrompt),
    (err) => err instanceof PromptInputError && err.code === 'E_INLINE_UNSAFE'
  );
  console.log('  ✔ readInline: Prompt panjang >300 karakter ditolak (E_INLINE_UNSAFE)');

  // 4. File reading works
  const tmpFile = path.join(__dirname, 'test_prompt_tmp.txt');
  fs.writeFileSync(tmpFile, '\uFEFFFormula: $\\int_0^1 x^2 dx = \\frac{1}{3}$\nBuktikan.');
  try {
    const res = await resolvePrompt({ promptFile: tmpFile });
    assert(res.includes('Formula:'), 'Harus membaca isi file');
    assert(!res.startsWith('\uFEFF'), 'BOM harus dibersihkan');
    console.log('  ✔ resolvePrompt: Pembacaan file dan pembersihan BOM sukses');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }

  // 5. Missing file error
  await assert.rejects(
    async () => await resolvePrompt({ promptFile: 'file_yang_pasti_tidak_ada.txt' }),
    (err) => err instanceof PromptInputError && err.code === 'E_FILE_MISSING'
  );
  console.log('  ✔ resolvePrompt: File tidak ada melempar E_FILE_MISSING');

  // 6. Empty prompt error
  await assert.rejects(
    async () => await resolvePrompt({ inlineText: '   ' }),
    (err) => err instanceof PromptInputError && err.code === 'E_EMPTY'
  );
  console.log('  ✔ resolvePrompt: Prompt kosong melempar E_EMPTY');

  console.log('✅ Unit test prompt_input.test.js: BERHASIL (100% Passed)!\n');
}

if (require.main === module) {
  testPromptInput().catch((err) => {
    console.error('❌ Gagal pengujian prompt_input:', err);
    process.exit(1);
  });
}

module.exports = testPromptInput;
