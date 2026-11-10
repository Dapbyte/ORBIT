/**
 * Unit Test untuk PromptSynthesizer (Lyra 4-D Engine)
 */

const assert = require('assert');
const PromptSynthesizer = require('../src/prompt_synthesizer');

console.log('🧪 Memulai pengujian PromptSynthesizer (Lyra 4-D Engine)...');

const synthesizer = new PromptSynthesizer();

// 1. Uji Deconstruct mendeteksi domain PKM-KC
{
  const rawInput = 'ide pkm-kc 2026 gabungan hardware dan software';
  const deconstructed = synthesizer.deconstruct(rawInput);
  assert.strictEqual(deconstructed.detectedDomain, 'pkm_kc', 'Harus mendeteksi domain pkm_kc');
  assert.strictEqual(deconstructed.isPkm, true, 'isPkm harus bernilai true');
  console.log('  ✔ deconstruct: Deteksi domain pkm_kc sukses');
}

// 2. Uji Diagnose mendeteksi ketiadaan batasan
{
  const rawInput = 'usulkan ide pkm-kc prototipe nyata';
  const deconstructed = synthesizer.deconstruct(rawInput);
  const diagnosis = synthesizer.diagnose(deconstructed);
  assert.ok(diagnosis.gaps.length >= 2, 'Harus mendeteksi minimal 2 celah batasan');
  assert.ok(diagnosis.gaps.some(g => g.includes('pagu anggaran')), 'Harus mendeteksi ketiadaan batas pagu');
  console.log('  ✔ diagnose: Deteksi celah batasan pagu dan waktu sukses');
}

// 3. Uji Develop menyuntikkan Negative Constraints & batasan BoM
{
  const rawInput = 'ide pkm-kc 2026 hardware software';
  const res = synthesizer.synthesize(rawInput);
  const prompt = res.optimizedPrompt;

  assert.ok(prompt.includes('STRICT BOUNDARY CONSTRAINTS'), 'Harus memuat header batasan mutlak');
  assert.ok(prompt.includes('Rp3.500.000'), 'Harus memuat plafon BoM hardware Rp3.500.000');
  assert.ok(prompt.includes('NEGATIVE CONSTRAINTS'), 'Harus memuat negative constraints');
  assert.ok(prompt.includes('MPU6050'), 'Harus melarang MPU6050');
  assert.ok(prompt.includes('Optical DO'), 'Harus melarang Optical DO probe');
  console.log('  ✔ develop: Penyuntikan Negative Constraints & BoM Ceiling sukses');
}

// 4. Uji Render Preview Box
{
  const rawInput = 'ide pkm-kc 2026';
  const res = synthesizer.synthesize(rawInput);
  assert.ok(res.previewBox.includes('LYRA PROMPT OPTIMIZER PREVIEW'), 'Preview box harus memiliki judul yang sesuai');
  assert.ok(res.previewBox.includes('pkm_kc'), 'Preview box harus memuat domain pkm_kc');
  console.log('  ✔ deliver: Render preview box sukses');
}

// 5. Uji Deteksi dan Optimasi Domain Software Engineering
{
  const rawInput = 'testing coding bug websocket frontend and backend synchronization di repo nextjs nestjs';
  const deconstructed = synthesizer.deconstruct(rawInput);
  assert.strictEqual(deconstructed.detectedDomain, 'software_engineering', 'Harus mendeteksi software_engineering');

  const res = synthesizer.synthesize(rawInput);
  assert.ok(res.optimizedPrompt.includes('Principal Software Architect'), 'Harus menyuntikkan persona Principal Software Architect');
  assert.ok(res.optimizedPrompt.includes('Zero Placeholder'), 'Harus menyuntikkan batasan Zero Placeholder');
  assert.ok(res.optimizedPrompt.includes('AI Slop UI'), 'Harus menyuntikkan pantangan AI Slop UI');
  assert.ok(!res.optimizedPrompt.includes('MPU6050'), 'Tidak boleh memuat larangan sensor MPU6050');
  console.log('  ✔ softwareEngineering: Deteksi dan sintesis domain software_engineering sukses');
}

console.log('✅ Unit test prompt_synthesizer.test.js: BERHASIL (100% Passed)!');
