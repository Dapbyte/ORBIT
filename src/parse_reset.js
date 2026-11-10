/**
 * parse_reset.js
 * Parser deterministik untuk mengekstraksi timestamp reset kuota dari teks UI Web LLM
 * Mendukung format multibahasa (Indonesia & Inggris), format relatif (dalam X jam/menit),
 * dan format absolut tanggal/jam (Gemini, Claude, ChatGPT, Qwen).
 */

const MONTHS = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, november: 10,
  des: 11, dec: 11, desember: 11, december: 11
};

const RELATIVE_REGEX = /\b(?:in|dalam)\s+(?:(\d+)\s*(?:hours?|hrs?|jam))?(?:\s*(?:and|dan)?\s*(\d+)\s*(?:minutes?|mins?|menit))?/i;
const TIME_HM_REGEX = /(?<![\d./:])(\d{1,2})[.:](\d{2})(?![./:]\d)(?!\d)\s*(am|pm)?/i;
const TIME_H_AMPM_REGEX = /(?<![\d./:])(\d{1,2})\s*(am|pm)\b/i;
const DATE_DM_REGEX = /\b(\d{1,2})\s+([a-zA-Z]{3,9})\.?/i;
const DATE_MD_REGEX = /\b([a-zA-Z]{3,9})\.?\s+(\d{1,2})\b/i;

function normalize(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .normalize('NFKC')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\b([ap])\.m\.?/gi, '$1m')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getZonedParts(epoch, tz) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  return Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p => [p.type, p.value]));
}

function tzOffsetMs(epoch, tz) {
  const p = getZonedParts(epoch, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

function zonedToEpoch(wall, hour, minute, tz) {
  const guess = Date.UTC(wall.year, wall.month, wall.day, hour, minute);
  const first = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(first, tz);
}

function findDate(text) {
  const matchDM = text.match(DATE_DM_REGEX);
  if (matchDM) {
    const month = MONTHS[matchDM[2].toLowerCase()];
    const day = parseInt(matchDM[1], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  const matchMD = text.match(DATE_MD_REGEX);
  if (matchMD) {
    const month = MONTHS[matchMD[1].toLowerCase()];
    const day = parseInt(matchMD[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  return null;
}

/**
 * Mengekstrak epoch timestamp (milidetik) dari string reset kuota.
 * @param {string} raw - String pesan limit dari UI browser
 * @param {object} [options] - Opsi jam acuan
 * @param {number} [options.nowMs] - Timestamp saat ini (default: Date.now())
 * @param {string} [options.timeZone] - Zona waktu IANA (default: zona waktu lokal sistem)
 * @returns {number|null} Timestamp epoch dalam milidetik, atau null jika gagal diparse
 */
function parseResetText(raw, options = {}) {
  if (!raw || typeof raw !== 'string') return null;

  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const timeZone = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const text = normalize(raw);

  // 1. Format Relatif ("dalam 2 jam 15 menit", "in 45 minutes")
  const relMatch = text.match(RELATIVE_REGEX);
  if (relMatch && (relMatch[1] !== undefined || relMatch[2] !== undefined)) {
    const hours = parseInt(relMatch[1] || '0', 10);
    const minutes = parseInt(relMatch[2] || '0', 10);
    if (hours > 0 || minutes > 0) {
      return nowMs + ((hours * 60) + minutes) * 60 * 1000;
    }
  }

  // 2. Ekstraksi Jam dan Menit
  let hour;
  let minute;
  let ampm;

  const hmMatch = text.match(TIME_HM_REGEX);
  if (hmMatch) {
    hour = parseInt(hmMatch[1], 10);
    minute = parseInt(hmMatch[2], 10);
    ampm = hmMatch[3];
  } else {
    const haMatch = text.match(TIME_H_AMPM_REGEX);
    if (!haMatch) return null;
    hour = parseInt(haMatch[1], 10);
    minute = 0;
    ampm = haMatch[2];
  }

  if (minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (ampm === 'pm' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }

  // 3. Ekstraksi Tanggal & Konversi ke Epoch
  const currentParts = getZonedParts(nowMs, timeZone);
  const todayWall = {
    year: parseInt(currentParts.year, 10),
    month: parseInt(currentParts.month, 10) - 1,
    day: parseInt(currentParts.day, 10)
  };

  const parsedDate = findDate(text);

  if (parsedDate) {
    let target = zonedToEpoch(
      { year: todayWall.year, month: parsedDate.month, day: parsedDate.day },
      hour, minute, timeZone
    );
    // Jika tanggal target di masa lalu (misal akhir tahun melompati Jan), tambahkan 1 tahun
    if (target < nowMs - 60000) {
      target = zonedToEpoch(
        { year: todayWall.year + 1, month: parsedDate.month, day: parsedDate.day },
        hour, minute, timeZone
      );
    }
    return target;
  }

  // Jika tanpa tanggal spesifik (hanya jam), asumsikan hari ini atau besok
  let target = zonedToEpoch(todayWall, hour, minute, timeZone);
  if (target <= nowMs) {
    // Lewat dari jam hari ini, target adalah besok
    const tomorrow = new Date(Date.UTC(todayWall.year, todayWall.month, todayWall.day + 1));
    const tomorrowWall = {
      year: tomorrow.getUTCFullYear(),
      month: tomorrow.getUTCMonth(),
      day: tomorrow.getUTCDate()
    };
    target = zonedToEpoch(tomorrowWall, hour, minute, timeZone);
  }

  return target;
}

module.exports = {
  parseResetText,
  normalize
};
