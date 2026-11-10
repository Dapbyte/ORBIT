'use strict';
/**
 * math_normalizer.js — normalisasi delimiter LaTeX untuk output LLM mentah (Qwen/ChatGPT/Claude).
 * Zero dependency. CommonJS. Node >= 16 (lookbehind + String.prototype.replaceAll).
 *
 * Yang dilakukan:
 *   1. Melindungi code fence (``` / ~~~) dan inline code. Isi kode TIDAK PERNAH disentuh.
 *   2. Mengonversi \[..\], \(..\), \begin{equation|align|gather|...} ke $$..$$ / $..$,
 *      dengan lookbehind yang paham jumlah backslash (\\[2pt] bukan pembuka display math).
 *   3. Menambal ketidakcocokan KaTeX yang aman diperbaiki (\label, \bm, % tanpa escape, baris kosong).
 *   4. Validasi struktural ringan. Formula rusak DIKARANTINA (bukan ditebak/diperbaiki diam-diam).
 *
 * Yang TIDAK dilakukan (batasan jujur):
 *   - Ini bukan parser TeX. validateTex() adalah heuristik (kurung, \left/\right, \begin/\end,
 *     daftar perintah/environment yang saya tahu tidak didukung KaTeX). Daftar itu ditulis dari
 *     pengetahuan saya dan harus dicocokkan dengan versi KaTeX Anda. Gunakan katex.renderToString
 *     sebagai validator final di sisi UI bila tersedia.
 *   - Nomor persamaan dari align/equation hilang (\begin{align} -> aligned). Disengaja.
 *   - Indented code block (4 spasi) tidak dikenali sebagai kode. Hanya fence dan backtick.
 *   - $...$ yang sudah ada hanya dikenali dengan aturan ala pandoc (anti-mata-uang), bukan ditebak.
 */
 
const OPEN = '\uE000';
const CLOSE = '\uE001';
const TOKEN_RE = /\uE000(\d+)\uE001/g;
 
// ───────────────────────── tabel environment ─────────────────────────
const UNWRAP_ENVS = new Set(['equation', 'equation*', 'displaymath']);
const RENAME_ENVS = new Map([
  ['align', 'aligned'], ['align*', 'aligned'],
  ['eqnarray', 'aligned'], ['eqnarray*', 'aligned'],
  ['split', 'aligned'],
  ['gather', 'gathered'], ['gather*', 'gathered'],
  ['multline', 'gathered'], ['multline*', 'gathered'],
]);
// Environment yang, bila muncul "telanjang" di luar delimiter, dibungkus sebagai display math.
const TOPLEVEL_ENVS = new Set([
  ...UNWRAP_ENVS, ...RENAME_ENVS.keys(),
  'aligned', 'gathered', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'smallmatrix', 'cases', 'array',
]);
// Environment yang menurut pengetahuan saya aman di KaTeX setelah normalisasi. VERIFIKASI per versi.
const KNOWN_ENVS = new Set([
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'array',
  'subarray', 'cases', 'rcases', 'aligned', 'gathered', 'alignedat', 'CD',
]);
const UNSUPPORTED_CMDS = new Set([
  'ref', 'eqref', 'cite', 'intertext', 'includegraphics', 'usepackage', 'documentclass',
  'tikz', 'footnote', 'caption',
]);
 
// ───────────────────────── regex inti ─────────────────────────
const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const INLINE_CODE = /(?<!`)(`+)(?!`)((?:(?!\n[ \t]*\n)[\s\S])*?[^`])\1(?!`)/g;
const EXISTING_DISPLAY = /\$\$([\s\S]+?)\$\$/g;
// Aturan pandoc: pembuka tidak diikuti spasi, penutup tidak didahului spasi dan tidak diikuti digit.
const EXISTING_INLINE = /(?<![\\$])\$(?![\s$])([^$\n]*?[^\s$\\])\$(?![\d$])/g;
const ENV_RE = /\\begin\{([A-Za-z]+\*?)\}([\s\S]*?)\\end\{\1\}/g;
// (?<!\\)((?:\\\\)*)\\\[ : pembuka sah hanya bila didahului jumlah backslash GENAP. \\[2pt] tidak cocok.
const BRACKET_DISPLAY = /(?<!\\)((?:\\\\)*)\\\[([\s\S]{1,20000}?)(?<!\\)((?:\\\\)*)\\\]/g;
const PAREN_INLINE = /(?<!\\)((?:\\\\)*)\\\(((?:(?!\n[ \t]*\n)[\s\S]){1,2000}?)(?<!\\)((?:\\\\)*)\\\)/g;
 
// ───────────────────────── masking ─────────────────────────
function hold(store, entry) {
  store.push(entry);
  return OPEN + (store.length - 1) + CLOSE;
}
 
function maskInlineCode(text, store) {
  return text.replace(INLINE_CODE, (raw) => hold(store, { t: 'code', raw }));
}
 
/** Fence berbasis baris. Fence yang tidak tertutup dianggap kode sampai akhir teks. */
function maskCode(src, store) {
  const lines = src.split('\n');
  const out = [];
  let buf = [];
  const flush = () => {
    if (buf.length) { out.push(maskInlineCode(buf.join('\n'), store)); buf = []; }
  };
  for (let i = 0; i < lines.length;) {
    const m = FENCE_OPEN.exec(lines[i]);
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      flush();
      const ch = m[1][0], len = m[1].length;
      const closeRe = new RegExp(`^[ \\t]*\\${ch}{${len},}[ \\t]*$`);
      let j = i + 1;
      while (j < lines.length && !closeRe.test(lines[j])) j++;
      const end = Math.min(j, lines.length - 1);
      out.push(hold(store, { t: 'code', raw: lines.slice(i, end + 1).join('\n') }));
      i = end + 1;
    } else {
      buf.push(lines[i]);
      i++;
    }
  }
  flush();
  return out.join('\n');
}
 
const unmask = (s, store) =>
  s.replace(TOKEN_RE, (m, i) => (store[+i] && store[+i].t === 'code' ? store[+i].raw : m));
 
// ───────────────────────── KaTeX compat ─────────────────────────
/** Perbaikan yang aman dan dapat dibalik secara makna. Mengembalikan {tex, fixes[]}. */
function cleanTex(tex, display = true) {
  const fixes = [];
  let t = String(tex);
  const fix = (name, re, rep) => {
    const n = t.replace(re, rep);
    if (n !== t) { fixes.push(name); t = n; }
  };
  fix('label-removed', /\\label\s*\{[^{}]*\}/g, '');
  fix('env-normalized', /\\(begin|end)\{([A-Za-z]+\*?)\}/g, (m, be, name) =>
    UNWRAP_ENVS.has(name) ? '' : RENAME_ENVS.has(name) ? `\\${be}{${RENAME_ENVS.get(name)}}` : m);
  fix('bm-to-boldsymbol', /\\bm(?![A-Za-z])/g, '\\boldsymbol');
  fix('mathbbm-to-mathbb', /\\mathbbm(?![A-Za-z])/g, '\\mathbb');
  // % tanpa escape = komentar TeX: diam-diam memotong sisa baris. Hampir selalu salah di output LLM.
  fix('percent-escaped', /(?<!\\)((?:\\\\)*)%/g, '$1\\%');
  if (display) fix('blank-lines-removed', /\n[ \t]*(?:\n[ \t]*)+/g, '\n');
  else fix('newlines-flattened', /\s*\n\s*/g, ' ');
  return { tex: t.trim(), fixes };
}
 
const CMD_RE = /\\([A-Za-z]+|[\s\S])/y;
const ENVNAME_RE = /\s*\{([^{}]*)\}/y;
 
/**
 * Validasi struktural heuristik. errors[] berisi {code, severity}.
 * 'hard' = hampir pasti gagal render. 'soft' = bergantung daftar perintah/env yang mungkin basi.
 */
function validateTex(tex) {
  const errors = [];
  const add = (code, severity = 'hard') => {
    if (!errors.some((e) => e.code === code)) errors.push({ code, severity });
  };
  const done = () => ({ ok: errors.length === 0, hard: errors.some((e) => e.severity === 'hard'), errors });
 
  if (!tex || !tex.trim()) { add('empty'); return done(); }
  let depth = 0, lr = 0;
  const envs = [];
  for (let i = 0; i < tex.length;) {
    const c = tex[i];
    if (c === '\\') {
      CMD_RE.lastIndex = i;
      const m = CMD_RE.exec(tex);
      if (!m) { add('dangling-backslash'); break; }
      i += m[0].length;
      const name = m[1];
      if (name === 'begin' || name === 'end') {
        ENVNAME_RE.lastIndex = i;
        const e = ENVNAME_RE.exec(tex);
        if (!e) { add('malformed-env'); continue; }
        i += e[0].length;
        const en = e[1].trim();
        if (name === 'begin') {
          envs.push(en);
          if (!KNOWN_ENVS.has(en)) add(`unsupported-env:${en}`, 'soft');
        } else if (envs.pop() !== en) add('env-mismatch');
      } else if (name === 'left') lr++;
      else if (name === 'right') { if (--lr < 0) { add('right-without-left'); lr = 0; } }
      else if (UNSUPPORTED_CMDS.has(name)) add(`unsupported-cmd:${name}`, 'soft');
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { if (--depth < 0) { add('unbalanced-brace'); depth = 0; } }
    else if (c === '$') add('stray-dollar');
    else if (c === '%') { const nl = tex.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
    i++;
  }
  if (depth) add('unbalanced-brace');
  if (lr) add('left-right-mismatch');
  if (envs.length) add('unclosed-env');
  return done();
}
 
// ───────────────────────── rendering ─────────────────────────
function fenceFor(s) {
  const run = Math.max(0, ...(s.match(/`+/g) || []).map((x) => x.length));
  return '`'.repeat(Math.max(3, run + 1));
}
 
function codeSpan(s) {
  const run = Math.max(0, ...(s.match(/`+/g) || []).map((x) => x.length));
  const t = '`'.repeat(run + 1);
  return `${t} ${s} ${t}`;
}
 
/** Blok display diberi baris kosong di sekitarnya dan mewarisi indentasi (aman di dalam list). */
function renderDisplay(tex, whole, off) {
  const ls = whole.lastIndexOf('\n', off - 1) + 1;
  const lead = /^[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?/.exec(whole.slice(ls, off))[0].replace(/[^\t]/g, ' ');
  const body = tex.split('\n').map((l) => lead + l).join('\n');
  return `\n\n${lead}$$\n${body}\n${lead}$$\n\n${lead}`;
}
 
function sample(tex) { return tex.replace(/\s+/g, ' ').slice(0, 60); }
 
/**
 * @param {string} input teks markdown mentah
 * @param {{convertEnvs?: boolean}} [opts]
 * @returns {{text: string, report: {converted:number, fixes:Array, quarantined:Array, warnings:Array}}}
 */
function normalizeMath(input, opts = {}) {
  const o = { convertEnvs: true, ...opts };
  const report = { converted: 0, fixes: [], quarantined: [], warnings: [] };
  const src = String(input ?? '').replace(/\r\n?/g, '\n').replaceAll(OPEN, '').replaceAll(CLOSE, '');
  const store = [];
 
  const holdMath = (display, tex, raw, origin) => {
    if (origin === 'converted') report.converted++;
    return hold(store, { t: 'math', display, tex, raw, origin });
  };
 
  // 1. lindungi kode, lalu math yang sudah ada
  let s = maskCode(src, store);
  s = s.replace(EXISTING_DISPLAY, (raw, tex) => holdMath(true, tex, raw, 'existing'));
  s = s.replace(EXISTING_INLINE, (raw, tex) => holdMath(false, tex, raw, 'existing'));
 
  // 2. konversi delimiter/environment
  if (o.convertEnvs) {
    s = s.replace(ENV_RE, (raw, name) => (TOPLEVEL_ENVS.has(name) ? holdMath(true, raw, raw, 'converted') : raw));
  }
  s = s.replace(BRACKET_DISPLAY, (raw, pre, body, post) =>
    body.trim() ? pre + holdMath(true, body + post, raw, 'converted') : raw);
  s = s.replace(PAREN_INLINE, (raw, pre, body, post) =>
    body.trim() ? pre + holdMath(false, body + post, raw, 'converted') : raw);
 
  // 3. bersihkan + validasi + render (kode masih termask)
  const resolve = (e, whole, off) => {
    const { tex, fixes } = cleanTex(unmask(e.tex, store), e.display);
    for (const f of fixes) report.fixes.push({ fix: f, sample: sample(tex) });
    const v = validateTex(tex);
    // Math hasil konversi: error apa pun -> karantina. Math asli: hanya error 'hard' (hindari false positive).
    const quarantine = e.origin === 'converted' ? !v.ok : v.hard;
    if (!quarantine) {
      for (const er of v.errors) report.warnings.push({ code: er.code, sample: sample(tex) });
      return e.display ? renderDisplay(tex, whole, off) : `$${tex}$`;
    }
    report.quarantined.push({ tex, errors: v.errors.map((x) => x.code), display: e.display });
    if (e.display) {
      const f = fenceFor(tex);
      return `\n\n${f}tex\n${tex}\n${f}\n\n`;
    }
    return codeSpan(tex);
  };
  s = s.replace(TOKEN_RE, (m, i, off, whole) => (store[+i].t === 'math' ? resolve(store[+i], whole, off) : m));
 
  // 4. rapikan spasi (kode masih termask, jadi aman), lalu kembalikan kode
  s = s.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  if (!src.startsWith('\n')) s = s.replace(/^\n+/, '');
  if (!src.endsWith('\n')) s = s.replace(/\n+$/, '');
  s = s.replace(TOKEN_RE, (m, i) => (store[+i] ? store[+i].raw : m));
 
  return { text: s, report };
}
 
const normalizeMathText = (md, opts) => normalizeMath(md, opts).text;
 
/**
 * Untuk hasil ekstraksi DOM: placeholder @@M<i>@@ (dibuat di sisi halaman dari <annotation> TeX)
 * dikembalikan sebagai \( \) / \[ \], lalu normalizeMath() yang menentukan bentuk akhir dan validasi.
 * Tidak pernah menebak: placeholder tanpa TeX menjadi penanda eksplisit.
 */
function restoreFormulaPlaceholders(md, math) {
  return String(md).replace(/@@M(\d+)@@/g, (_, i) => {
    const m = math[+i];
    if (!m || !m.tex || !m.tex.trim()) return '[[FORMULA_UNRESOLVED]]';
    return m.display ? `\\[\n${m.tex.trim()}\n\\]` : `\\(${m.tex.trim()}\\)`;
  });
}
 
module.exports = { normalizeMath, normalizeMathText, validateTex, cleanTex, restoreFormulaPlaceholders };
 