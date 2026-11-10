const assert = require('assert');
const { parseResetText, normalize } = require('../src/parse_reset');

console.log('🧪 Memulai pengujian parse_reset.js (Multilingual Quota Reset Parser)...');

// Acuan waktu: 14 Oktober 2026, pukul 20:00:00 WIB (Asia/Jakarta, UTC+7)
const tz = 'Asia/Jakarta';
const baseDate = new Date('2026-10-14T13:00:00.000Z'); // 20:00 WIB
const nowMs = baseDate.getTime();

// 1. Pengujian Format Gemini Indonesia ("Batas direset pada 14 Okt, 20.51")
{
  const text = 'Batas direset pada 14 Okt, 20.51';
  const epoch = parseResetText(text, { nowMs, timeZone: tz });
  assert(epoch !== null, 'Harus berhasil mem-parse format Gemini Indonesia');
  const d = new Date(epoch);
  assert.strictEqual(d.toISOString(), '2026-10-14T13:51:00.000Z', 'Harus tepat 20:51 WIB (13:51 UTC)');
  console.log('  ✔ Format Gemini Indonesia (14 Okt, 20.51) sukses diparse');
}

// 2. Pengujian Format Gemini Inggris ("Limit resets on Oct 14, 8:51 PM")
{
  const text = 'Limit resets on Oct 14, 8:51 PM';
  const epoch = parseResetText(text, { nowMs, timeZone: tz });
  assert(epoch !== null, 'Harus berhasil mem-parse format Gemini Inggris');
  const d = new Date(epoch);
  assert.strictEqual(d.toISOString(), '2026-10-14T13:51:00.000Z', 'Harus tepat 20:51 WIB (13:51 UTC)');
  console.log('  ✔ Format Gemini Inggris (Oct 14, 8:51 PM) sukses diparse');
}

// 3. Pengujian Format Claude ("You are out of free messages until 3:00 AM")
{
  const text = 'You are out of free messages until 3:00 AM';
  const epoch = parseResetText(text, { nowMs, timeZone: tz });
  assert(epoch !== null, 'Harus berhasil mem-parse format Claude');
  const d = new Date(epoch);
  // Jam sekarang 20:00 WIB tanggal 14, target 3:00 AM adalah besok pagi tanggal 15 Oktober pukul 03:00 WIB = 14 Oktober 20:00 UTC
  assert.strictEqual(d.toISOString(), '2026-10-14T20:00:00.000Z', 'Harus tepat 03:00 WIB tanggal 15 Okt (20:00 UTC 14 Okt)');
  console.log('  ✔ Format Claude (until 3:00 AM besok) sukses diparse');
}

// 4. Pengujian Format ChatGPT ("Try again after 9:30 PM")
{
  const text = "You've reached your GPT-4o limit. Try again after 9:30 PM.";
  const epoch = parseResetText(text, { nowMs, timeZone: tz });
  assert(epoch !== null, 'Harus berhasil mem-parse format ChatGPT');
  const d = new Date(epoch);
  // Jam sekarang 20:00 WIB, 9:30 PM = 21:30 WIB = 14:30 UTC
  assert.strictEqual(d.toISOString(), '2026-10-14T14:30:00.000Z', 'Harus tepat 21:30 WIB (14:30 UTC)');
  console.log('  ✔ Format ChatGPT (after 9:30 PM) sukses diparse');
}

// 5. Pengujian Format Relatif ("dalam 45 menit" & "in 2 hours and 15 minutes")
{
  const textId = 'Layanan sibuk, coba lagi dalam 45 menit';
  const epochId = parseResetText(textId, { nowMs, timeZone: tz });
  assert.strictEqual(epochId, nowMs + 45 * 60 * 1000, 'Harus bertambah 45 menit');

  const textEn = 'Please try again in 2 hours and 15 minutes';
  const epochEn = parseResetText(textEn, { nowMs, timeZone: tz });
  assert.strictEqual(epochEn, nowMs + (135 * 60 * 1000), 'Harus bertambah 135 menit');
  console.log('  ✔ Format Relatif (Indonesia & Inggris) sukses diparse');
}

// 6. Pengujian Resilience (String tidak cocok atau sampah)
{
  assert.strictEqual(parseResetText('', { nowMs }), null);
  assert.strictEqual(parseResetText('Halo dunia, tidak ada batas di sini', { nowMs }), null);
  assert.strictEqual(parseResetText(null, { nowMs }), null);
  console.log('  ✔ String invalid/kosong deterministik mengembalikan null');
}

console.log('✅ Unit test parse_reset.test.js: BERHASIL (100% Passed)!');
