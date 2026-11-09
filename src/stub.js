// Reads the text of a pay stub (from the on-device text recognizer) and picks out the employer,
// the pay date, the pay period, the hours and the gross pay. Every value is a guess for the
// member or counselor to confirm with a "Use this" button. Nothing is sent anywhere.
// Same shape as bill.js: scan line by line, label each value by the last label word before it.

const MONTHS = Object.freeze({
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
});

const DATE_LABELS = Object.freeze([
  ['pay', /\b(pay date|check date|date paid|paid on|paid|advice date|payment date)\b/i],
  ['start', /\b(period (start|begins?|beginning)|start(ing)?|from|beginning)\b/i],
  ['end', /\b(period end(ing|s)?|end(ing)?|through|thru|to)\b/i],
  ['period', /\bpay period\b/i],
]);

const AMOUNT_LABELS = Object.freeze([
  ['gross', /\b(gross( pay| earnings| wages)?|total earnings|earnings|total pay)\b/i],
  ['net', /\b(net( pay)?|take[- ]home)\b/i],
  ['ytd', /\b(ytd|year[- ]to[- ]date)\b/i],
]);

const HOUR_ROW = /^\s*(regular|reg|overtime|ot|total hours|total)\b/i;
const HOUR_WORD = /\b(hours?|hrs?)\b/i;
const MAX_HOURS = 400;

const COMPANY_WORD = /\b(inc|llc|corp|corporation|company|ltd|group|services|health|hospital|restaurant|diner|market|store|school|university|county|city of)\b|\bco\./i;

const pad = (n) => String(n).padStart(2, '0');
const lines = (text) => String(text ?? '').split(/\r?\n/);

function isoFrom(year, month, day) {
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(y, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

// The label that applies to a value is the last label word before it on the same line.
function labelBefore(line, index, labels) {
  const before = line.slice(0, index);
  let best = null;
  let bestAt = -1;
  for (const [label, pattern] of labels) {
    const global = new RegExp(pattern.source, 'gi');
    let m;
    while ((m = global.exec(before)) !== null) {
      if (m.index > bestAt) { bestAt = m.index; best = label; }
    }
  }
  return best;
}

// Every date, in order, labeled pay, start, end or period. On a "Pay Period" line the first
// two period dates are the start and the end.
export function findStubDates(text) {
  const found = [];
  for (const line of lines(text)) {
    const hits = [];
    for (const m of line.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/g)) {
      const iso = isoFrom(Number(m[3]), Number(m[1]), Number(m[2]));
      if (iso) hits.push({ iso, index: m.index });
    }
    for (const m of line.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
      const month = MONTHS[m[1].toLowerCase()];
      const iso = month ? isoFrom(Number(m[3]), month, Number(m[2])) : null;
      if (iso) hits.push({ iso, index: m.index });
    }
    hits.sort((a, b) => a.index - b.index);
    const labeled = hits.map((hit) => ({ iso: hit.iso, label: labelBefore(line, hit.index, DATE_LABELS), source: line.trim() }));
    const periodSlots = ['start', 'end'];
    for (const hit of labeled) {
      if (hit.label === 'period' && periodSlots.length) hit.label = periodSlots.shift();
      found.push(hit);
    }
  }
  return found;
}

const numbersOn = (line) => [...line.matchAll(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g)].map((m) => Number(m[0].replace(/,/g, '')));
const plausibleHours = (n) => Number.isFinite(n) && n > 0 && n <= MAX_HOURS;

// Hours by row: the second number on a Regular or Overtime row (rate, hours, pay), the first
// number on a line that says "hours".
export function findHours(text) {
  const found = [];
  for (const line of lines(text)) {
    const row = HOUR_ROW.exec(line);
    if (row) {
      const word = row[1].toLowerCase();
      const label = word.startsWith('reg') ? 'regular' : word === 'overtime' || word === 'ot' ? 'overtime' : 'total';
      const value = numbersOn(line)[label === 'total' ? 0 : 1];
      if (plausibleHours(value)) found.push({ hours: value, label, source: line.trim() });
      continue;
    }
    if (!HOUR_WORD.test(line) || /\$/.test(line)) continue;
    const value = numbersOn(line.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ''))[0];
    if (plausibleHours(value)) found.push({ hours: value, label: /\btotal\b/i.test(line) ? 'total' : null, source: line.trim() });
  }
  return found;
}

// Every dollar amount with the label of its line: gross, net or ytd.
export function findGross(text) {
  const found = [];
  for (const line of lines(text)) {
    for (const m of line.matchAll(/(-?)\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g)) {
      const cents = Number(m[2].replace(/,/g, '')) * 100 + Number(m[3] ?? 0);
      found.push({ cents: m[1] ? -cents : cents, label: labelBefore(line, m.index, AMOUNT_LABELS), source: line.trim() });
    }
  }
  return found;
}

// The first line with a company word. A receipt with none gives no employer rather than a guess.
export function findEmployer(text) {
  for (const line of lines(text)) {
    if (COMPANY_WORD.test(line)) return line.trim();
  }
  return null;
}

const finding = (value, source) => (value === null || value === undefined ? null : Object.freeze({ value, source }));

function pickDates(dates) {
  const pay = dates.find((d) => d.label === 'pay') ?? (dates.length ? dates.reduce((best, d) => (d.iso > best.iso ? d : best)) : null);
  let start = dates.find((d) => d.label === 'start') ?? null;
  let end = dates.find((d) => d.label === 'end') ?? null;
  if (!start && !end) {
    const rest = dates.filter((d) => d !== pay).sort((a, b) => (a.iso < b.iso ? -1 : 1));
    if (rest.length >= 2) [start, end] = rest;
  }
  return { pay, start, end };
}

function pickHours(hours) {
  const total = hours.find((h) => h.label === 'total');
  if (total) return total;
  const rows = hours.filter((h) => h.label === 'regular' || h.label === 'overtime');
  if (rows.some((h) => h.label === 'regular')) {
    return { hours: rows.reduce((sum, h) => sum + h.hours, 0), source: rows.map((h) => h.source).join(' | ') };
  }
  const loose = hours.filter((h) => h.label === null);
  return loose.length ? loose.reduce((best, h) => (h.hours > best.hours ? h : best)) : null;
}

function pickGross(amounts) {
  const gross = amounts.find((a) => a.label === 'gross' && a.cents > 0);
  if (gross) return gross;
  const candidates = amounts.filter((a) => a.cents > 0 && a.label !== 'ytd' && a.label !== 'net');
  return candidates.length ? candidates.reduce((best, a) => (a.cents > best.cents ? a : best)) : null;
}

export function readStub(text) {
  const { pay, start, end } = pickDates(findStubDates(text));
  const hours = pickHours(findHours(text));
  const gross = pickGross(findGross(text));
  const employer = findEmployer(text);
  return Object.freeze({
    employer: finding(employer, employer),
    payDate: finding(pay?.iso ?? null, pay?.source),
    periodStart: finding(start?.iso ?? null, start?.source),
    periodEnd: finding(end?.iso ?? null, end?.source),
    hours: finding(hours?.hours ?? null, hours?.source),
    grossCents: finding(gross?.cents ?? null, gross?.source),
  });
}
