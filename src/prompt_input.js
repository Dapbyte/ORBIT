'use strict';

/**
 * Prompt Input Resolver & Shell Safety Guard
 * Mencegah shell corruption (PowerShell quoting, variable expansion, LaTeX backslash mangling)
 * dengan mewajibkan file-buffering untuk prompt kompleks.
 */

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 512 * 1024; // 512 KB
const MAX_INLINE_LENGTH = 300;
const UNSAFE_INLINE = /[\r\n]/; // Multi-baris wajib pakai file

class PromptInputError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PromptInputError';
    this.code = code;
  }
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new PromptInputError('--stdin digunakan tanpa pipa input data.', 'E_STDIN_TTY'));
      return;
    }
    const chunks = [];
    let size = 0;
    process.stdin.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new PromptInputError(`Input stdin melebihi batas ${MAX_BYTES} byte.`, 'E_TOO_LARGE'));
        process.stdin.destroy();
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', (err) =>
      reject(new PromptInputError(`Gagal membaca stdin: ${err.message}`, 'E_STDIN_READ'))
    );
  });
}

function readPromptFile(filePath) {
  const abs = path.resolve(filePath);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch (err) {
    throw new PromptInputError(`File prompt tidak ditemukan: ${abs} (${err.code})`, 'E_FILE_MISSING');
  }
  if (!stat.isFile()) {
    throw new PromptInputError(`Target bukan file: ${abs}`, 'E_NOT_FILE');
  }
  if (stat.size > MAX_BYTES) {
    throw new PromptInputError(`Ukuran file prompt (${stat.size} byte) melebihi batas ${MAX_BYTES} byte.`, 'E_TOO_LARGE');
  }
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch (err) {
    throw new PromptInputError(`Gagal membaca file prompt: ${err.message}`, 'E_FILE_READ');
  }
}

function readInline(inlineText) {
  if (inlineText.length > MAX_INLINE_LENGTH || UNSAFE_INLINE.test(inlineText)) {
    throw new PromptInputError(
      `Prompt inline tidak aman (panjang >${MAX_INLINE_LENGTH} karakter atau memiliki baris baru). Gunakan opsi --prompt-file <path> untuk mencegah shell escaping corruption.`,
      'E_INLINE_UNSAFE'
    );
  }
  return inlineText;
}

/**
 * Menyelesaikan isi prompt dari --prompt-file, --stdin, atau inline string
 * @param {Object} options { promptFile, stdin, inlineText }
 * @returns {Promise<string>}
 */
async function resolvePrompt({ promptFile, stdin, inlineText }) {
  let raw;
  if (promptFile) {
    raw = readPromptFile(promptFile);
  } else if (stdin) {
    raw = await readStdin();
  } else {
    raw = readInline(inlineText || '');
  }

  const prompt = stripBom(raw).trim();
  if (prompt.length === 0) {
    throw new PromptInputError('Prompt tidak boleh kosong.', 'E_EMPTY');
  }
  return prompt;
}

module.exports = {
  resolvePrompt,
  readPromptFile,
  readInline,
  PromptInputError,
  MAX_INLINE_LENGTH,
  MAX_BYTES
};
