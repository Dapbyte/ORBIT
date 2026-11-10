const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Orchestrator = require('../src/orchestrator');

function testOrchestratorFileHandling() {
  const orchestrator = new Orchestrator();

  // Test 1: File normal berhasil dibaca
  const dummyFile = path.join(__dirname, 'dummy_test.tex');
  fs.writeFileSync(dummyFile, '\\section{Methodology}\nEquation: E=mc^2', 'utf-8');

  const bundle = orchestrator.resolveFiles([dummyFile]);
  assert(bundle.includes('dummy_test.tex'), 'Harus menyertakan nama file');
  assert(bundle.includes('E=mc^2'), 'Harus memuat konten file');

  // Test 1b: File dengan path absolut lintas direktori berhasil dibaca
  const absTemp = path.join(os.tmpdir(), 'bluesentinel_test_snippet.ts');
  fs.writeFileSync(absTemp, 'export const SOC_STATUS = "ACTIVE";', 'utf-8');
  const bundleAbs = orchestrator.resolveFiles([absTemp]);
  assert(bundleAbs.includes('bluesentinel_test_snippet.ts'), 'Harus menyertakan nama file absolut');
  assert(bundleAbs.includes('SOC_STATUS = "ACTIVE"'), 'Harus memuat konten file absolut');
  fs.unlinkSync(absTemp);

  // Test 2: File sensitif (.env) harus ditolak oleh Privacy Guard
  assert.throws(() => {
    orchestrator.resolveFiles(['.env']);
  }, /PRIVACY GUARD/, 'Harus memblokir file .env');

  assert.throws(() => {
    orchestrator.resolveFiles(['id_rsa']);
  }, /PRIVACY GUARD/, 'Harus memblokir file id_rsa');

  assert.throws(() => {
    orchestrator.resolveFiles(['secret.key']);
  }, /PRIVACY GUARD/, 'Harus memblokir file *.key');

  console.log('✅ Unit test orchestrator_files.test.js: BERHASIL (Privacy Guard 100% Passed)!');
}

testOrchestratorFileHandling();
