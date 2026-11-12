const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SessionHistory = require('../src/session_history');

const TEST_FILE = path.join(__dirname, 'test_session_v2.json');

console.log('🧪 Memulai pengujian SessionHistory v2.5 (Multi-Session & Dynamic Handoff)...');

if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);

const history = new SessionHistory(TEST_FILE, 'thread-alpha');

// 1. Thread Isolation & Active Session ID
assert.strictEqual(history.activeSessionId, 'thread-alpha');
history.addTurn('user', 'Pertanyaan di thread alpha');
history.addTurn('assistant', 'Jawaban dari Gemini di thread alpha', 'gemini');

assert.strictEqual(history.getTurns().length, 2);
console.log('  ✔ addTurn & thread session isolation sukses');

// 2. Dynamic Handoff Bundle with Gemini provider
const bundleGemini = history.buildHandoffBundle('Tugas lanjutan setelah Gemini limit', 3, { fromProvider: 'gemini' });
assert.ok(bundleGemini.includes('Sesi percakapan ini dialihkan dari Gemini'), 'Handoff bundle harus menyebutkan Gemini');
assert.ok(bundleGemini.includes('Pertanyaan di thread alpha'));
console.log('  ✔ buildHandoffBundle: Dynamic fromProvider (Gemini) sukses');

// 3. Switch Session
history.switchSession('thread-beta');
assert.strictEqual(history.activeSessionId, 'thread-beta');
assert.strictEqual(history.getTurns().length, 0, 'Thread beta harus kosong di awal');

history.addTurn('user', 'Pertanyaan di thread beta');
history.addTurn('assistant', 'Jawaban dari Qwen di thread beta', 'qwen');
assert.strictEqual(history.getTurns().length, 2);

const bundleQwen = history.buildHandoffBundle('Tugas lanjutan di thread beta');
assert.ok(bundleQwen.includes('Sesi percakapan ini dialihkan dari Qwen'), 'Harus auto-deteksi provider terakhir (Qwen)');
console.log('  ✔ switchSession & auto-detection of last assistant provider sukses');

// 4. List Sessions & Stats
const sessionsList = history.listSessions();
assert.strictEqual(sessionsList.length, 2, 'Harus mencatat 2 sesi terdaftar');
const stats = history.getStats();
assert.strictEqual(stats.sessionId, 'thread-beta');
assert.strictEqual(stats.userTurns, 1);
assert.strictEqual(stats.assistantTurns, 1);
console.log('  ✔ listSessions & getStats sukses');

// 5. Export Markdown
const md = history.exportMarkdown();
assert.ok(md.includes('# 🪐 ORBIT Session Transcript (thread-beta)'));
assert.ok(md.includes('Jawaban dari Qwen'));
console.log('  ✔ exportMarkdown sukses');

// 6. Metadata Tracking
history.setMetadata('domain', 'cybersecurity_audit');
assert.strictEqual(history.getMetadata().domain, 'cybersecurity_audit');
console.log('  ✔ setMetadata / getMetadata sukses');

// 7. Auto-compaction
for (let i = 0; i < 110; i++) {
  history.addTurn('user', `Message ${i}`);
}
assert.ok(history.getTurns().length <= 70 && history.getTurns().length >= 50, 'Harus auto-compact saat turn > 100 (sekitar 51-65 turns)');
assert.ok(history.getTurns()[0].content.includes('SYSTEM:'), 'Turn pertama harus berupa ringkasan kompak');
console.log('  ✔ auto-compaction sukses');

// Bersihkan
if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
console.log('✅ Unit test session_history_v2.test.js: BERHASIL (100% Passed)!');
