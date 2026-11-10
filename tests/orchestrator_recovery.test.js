const assert = require('assert');
const Orchestrator = require('../src/orchestrator');

function testOrchestratorRecovery() {
  console.log('🧪 Memulai pengujian Orchestrator Recovery & Math Normalizer...');
  const orchestrator = new Orchestrator();

  // Test 1: recoverSessionHandoff menghasilkan prompt ber-nonce dan sealed text rapi
  const partialText = '## 1. Analisis Awal\nSistem ini bekerja dengan baik.\n\n## 2. Rumus Inti\nRumus energinya adalah \\[ E = mc^2 \\]\n```python\ndef test():\n    print("unclosed code fence';

  const handoff = orchestrator.recoverSessionHandoff({
    previousProvider: 'claude',
    candidateProvider: 'qwen',
    partialText,
    taskPrompt: 'Buat analisis sistem lengkap',
    originalFullPrompt: 'Buat analisis sistem lengkap'
  });

  assert.strictEqual(handoff.canStitch, true, 'canStitch harus bernilai true');
  assert.ok(handoff.sealedText.length > 0, 'sealedText tidak boleh kosong');
  assert.ok(!handoff.sealedText.includes('unclosed code fence'), 'Unclosed fence harus dipangkas oleh sealTail');
  assert.ok(handoff.handoffPrompt.includes(handoff.nonce), 'Prompt harus memuat nonce bounding box');
  assert.ok(handoff.handoffPrompt.includes('BEGIN:TASK'), 'Prompt harus memuat marker TASK');
  assert.ok(handoff.handoffPrompt.includes('BEGIN:ANCHOR'), 'Prompt harus memuat marker ANCHOR');
  assert.ok(handoff.handoffPrompt.includes('BEGIN:WRITTEN_DIGEST'), 'Prompt harus memuat marker WRITTEN_DIGEST');

  // Test 2: recoverSessionHandoff fallback jika partialText kosong atau terlalu pendek
  const fallback = orchestrator.recoverSessionHandoff({
    previousProvider: 'claude',
    candidateProvider: 'qwen',
    partialText: 'terlalu pendek',
    taskPrompt: 'Tugas pendek',
    originalFullPrompt: 'Tugas pendek'
  });

  assert.strictEqual(fallback.canStitch, false, 'canStitch harus false pada partialText pendek');
  assert.strictEqual(fallback.sealedText, null, 'sealedText harus null pada fallback');
  assert.ok(fallback.handoffPrompt.includes('ATURAN KELUARAN'), 'Fallback harus menggunakan Bounded Context + Caveman');
  assert.ok(fallback.handoffPrompt.includes('HANDOFF CAVEMAN CONTINUATION'), 'Fallback harus menggunakan kontrak HANDOFF CAVEMAN CONTINUATION');
  assert.ok(handoff.handoffPrompt.includes('ZERO PREAMBLE'), 'Handoff prompt harus memuat aturan ZERO PREAMBLE');
  assert.ok(handoff.handoffPrompt.includes('NO METADATA'), 'Handoff prompt harus melarang baris metadata THING ACTION REASON');

  // Test 3: Stitcher membersihkan preamble bahasa Indonesia (Melanjutkan / Berikut kelanjutan)
  const { stitch } = require('../src/stream_recovery');
  const sealed = '## 1. Analisis\nAnalisis lengkap bagian awal.';
  const rawId = 'Melanjutkan dari dokumen sebelumnya:\n\n## 2. Bagian Lanjutan\nPenjelasan lanjutan yang cukup panjang untuk lolos batas minimal.';
  const stitchedId = stitch(sealed, rawId);
  assert.ok(stitchedId.ok, 'Stitch dengan preamble Indonesia harus berhasil');
  assert.ok(stitchedId.flags.includes('preface_removed'), 'Flag preface_removed harus aktif untuk preamble Indonesia');
  assert.ok(!stitchedId.text.includes('Melanjutkan dari dokumen sebelumnya'), 'Preamble harus dibersihkan dari teks akhir');

  console.log('✅ Unit test orchestrator_recovery.test.js: BERHASIL (100% Passed)!');
}

testOrchestratorRecovery();
