/**
 * Offline Fixture Tests
 * Menguji logika deteksi rate limit, auth challenge, dan ekstraksi formula LaTeX
 * menggunakan fixture HTML offline tanpa membutuhkan koneksi Chrome hidup.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock DOM parser sederhana untuk menguji transformasi KaTeX
function extractLaTeXFromHTML(htmlContent) {
  // Simulasi logika ekstraksi BaseDriver.extractResponse
  let clean = htmlContent;

  // 1. Ekstrak Display Math KaTeX (menangani nested span katex-display)
  clean = clean.replace(/<span[^>]*class="[^"]*katex-display[^"]*"[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span>\s*<\/span>/gi, (match, tex) => {
    return `\n$$\n${tex.trim()}\n$$\n`;
  });

  // 2. Ekstrak Inline Math KaTeX
  clean = clean.replace(/<span[^>]*class="[^"]*katex[^"]*"[^>]*>[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/gi, (match, tex) => {
    return ` $${tex.trim()}$ `;
  });

  // 3. Ekstrak MathJax script
  clean = clean.replace(/<script type="math\/tex">([\s\S]*?)<\/script>/gi, (match, tex) => {
    return ` $${tex.trim()}$ `;
  });

  // 4. Hapus HTML tags umum
  clean = clean.replace(/<[^>]+>/g, ' ');
  // Decode entitas umum
  clean = clean.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return clean.trim();
}

function testRateLimitPatternMatching(bodyText, patterns) {
  const lower = bodyText.toLowerCase();
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) {
      return { isLimited: true, pattern: p };
    }
  }
  return { isLimited: false };
}

function testAuthPatternMatching(bodyText, patterns) {
  const lower = bodyText.toLowerCase();
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) {
      return { authRequired: true, pattern: p };
    }
  }
  return { authRequired: false };
}

async function runTests() {
  console.log('🧪 Memulai Offline Fixture Tests...');

  const selectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'selectors.json'), 'utf-8'));

  // --- Test 1: Deteksi Rate Limit Claude & ChatGPT & Qwen ---
  const claudeLimitMock = 'Error: You have reached your message limit for today. Resets at 3:00 PM.';
  const claudeLimitCheck = testRateLimitPatternMatching(claudeLimitMock, selectors.claude.rate_limit_patterns);
  assert.strictEqual(claudeLimitCheck.isLimited, true, 'Claude message limit harus terdeteksi');
  assert(claudeLimitCheck.pattern.includes('limit'), 'Pola yang cocok harus mengandung limit');

  const qwenLimitMock = 'Sorry, your daily usage limit has been reached. Please try again later.';
  const qwenLimitCheck = testRateLimitPatternMatching(qwenLimitMock, selectors.qwen.rate_limit_patterns);
  assert.strictEqual(qwenLimitCheck.isLimited, true, 'Qwen usage limit harus terdeteksi');

  const chatgptLimitMock = "You've reached your limit for GPT-4. Try again later.";
  const chatgptLimitCheck = testRateLimitPatternMatching(chatgptLimitMock, selectors.chatgpt.rate_limit_patterns);
  assert.strictEqual(chatgptLimitCheck.isLimited, true, 'ChatGPT usage limit harus terdeteksi');

  // --- Test 2: Deteksi AUTH_REQUIRED / Cloudflare ---
  const cloudflareMock = 'Just a moment... Please verify you are human before proceeding to Claude.';
  const authCheckClaude = testAuthPatternMatching(cloudflareMock, selectors.claude.auth_patterns);
  assert.strictEqual(authCheckClaude.authRequired, true, 'Cloudflare Challenge harus terdeteksi sebagai AUTH_REQUIRED');

  const qwenLoginMock = 'Please sign in to continue chatting with Qwen.';
  const authCheckQwen = testAuthPatternMatching(qwenLoginMock, selectors.qwen.auth_patterns);
  assert.strictEqual(authCheckQwen.authRequired, true, 'Dialog sign in Qwen harus terdeteksi sebagai AUTH_REQUIRED');

  // --- Test 3: Ekstraksi Formula KaTeX Non-Destruktif ---
  const htmlWithKaTeX = `
    <div class="font-claude-message">
      Berikut adalah turunan formula:
      <span class="katex">
        <span class="katex-mathml">
          <math><semantics><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math>
        </span>
        <span class="katex-html" aria-hidden="true">E=mc²</span>
      </span>
      dan persamaan integral display:
      <span class="katex-display">
        <span class="katex"><annotation encoding="application/x-tex">\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}</annotation></span>
      </span>
    </div>
  `;

  const extracted = extractLaTeXFromHTML(htmlWithKaTeX);
  assert(extracted.includes('$E = mc^2$'), 'Formula inline harus diekstrak utuh');
  assert(extracted.includes('\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}'), 'Isi formula display harus diekstrak utuh');
  assert(extracted.includes('$$\n\\int_0^\\infty') || extracted.includes('$$\r\n\\int_0^\\infty'), 'Formula display harus dibungkus tag $$');

  // --- Test 4: Deteksi Rate Limit Gemini ---
  const geminiLimitMock = 'Batas kuota model 4 Argon telah habis. Batas direset pada 14 Okt, 20.51.';
  const geminiLimitCheck = testRateLimitPatternMatching(geminiLimitMock, selectors.gemini.rate_limit_patterns);
  assert.strictEqual(geminiLimitCheck.isLimited, true, 'Gemini limit pattern harus terdeteksi');

  console.log('✅ Unit test offline_fixtures.test.js: BERHASIL (100% Passed)!');
}

runTests().catch(err => {
  console.error('❌ Gagal test offline fixtures:', err);
  process.exit(1);
});
