// Reads the text of a hospital bill (from the on-device text recognizer) and picks out the
// three things the page can use: which hospital, the bill date, and the amount due.
// Everything here is a guess for the patient to confirm. Nothing is sent anywhere.

import { HOSPITALS } from './hospitals.js';

// Everyday names on a bill, mapped to the state's list. Longer names are checked first.
const ALIASES = Object.freeze([
  ['johns hopkins', 'johns-hopkins'], ['hopkins bayview', 'johns-hopkins'], ['howard county general', 'johns-hopkins'], ['suburban hospital', 'johns-hopkins'],
  ['medstar', 'medstar'], ['union memorial', 'medstar'], ['good samaritan', 'medstar'], ['franklin square', 'medstar'], ['harbor hospital', 'medstar'],
  ['montgomery medical', 'medstar'], ['southern maryland hospital', 'medstar'], ["st. mary's hospital", 'medstar'], ['st mary\'s hospital', 'medstar'],
  ['university of maryland', 'umms'], ['umms', 'umms'], ['um medical', 'umms'], ['um shore', 'umms'], ['um capital region', 'umms'], ['um upper chesapeake', 'umms'],
  ['um charles regional', 'umms'], ['baltimore washington medical', 'umms'], ['um st. joseph', 'umms'], ['um midtown', 'umms'], ['shore medical center', 'umms'],
  ['lifebridge', 'lifebridge'], ['sinai hospital', 'lifebridge'], ['northwest hospital', 'lifebridge'], ['carroll hospital', 'lifebridge'], ['grace medical', 'lifebridge'],
  ['luminis', 'luminis'], ['anne arundel medical', 'luminis'], ['doctors community', 'luminis'],
  ['tidalhealth', 'tidalhealth'], ['tidal health', 'tidalhealth'], ['peninsula regional', 'tidalhealth'], ['mccready', 'tidalhealth'],
  ['adventist', 'adventist'], ['shady grove', 'adventist'], ['white oak medical', 'adventist'],
  ['holy cross', 'holy-cross'],
  ['frederick health', 'frederick-health'], ['frederick memorial', 'frederick-health'],
  ['greater baltimore medical', 'gbmc'], ['gbmc', 'gbmc'],
  ['mercy medical', 'mercy'],
  ['meritus', 'meritus'],
  ['st. agnes', 'ascension-st-agnes'], ['saint agnes', 'ascension-st-agnes'], ['st agnes', 'ascension-st-agnes'],
  ['calverthealth', 'calverthealth'], ['calvert health', 'calverthealth'], ['calvert memorial', 'calverthealth'],
  ['union hospital', 'union-hospital'], ['christianacare', 'union-hospital'], ['christiana care', 'union-hospital'],
  ['garrett regional', 'garrett-regional'], ['garrett county memorial', 'garrett-regional'],
  ['upmc western maryland', 'upmc-western-maryland'], ['western maryland regional', 'upmc-western-maryland'],
  ['sheppard pratt', 'sheppard-pratt'],
  ['mt. washington pediatric', 'mt-washington-pediatric'], ['mt washington pediatric', 'mt-washington-pediatric'], ['mount washington pediatric', 'mt-washington-pediatric'],
].map(Object.freeze));

const MONTHS = Object.freeze({
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
});

const DATE_LABELS = Object.freeze([
  ['due', /\b(due|pay by|payable by|please pay)\b/i],
  ['statement', /\b(statement|bill(ing)? date|billed|invoice|date of (this )?(bill|statement|notice))\b/i],
  ['service', /\b(service|admit|admission|discharge|visit)\b/i],
]);

const AMOUNT_LABELS = Object.freeze([
  ['due', /\b(amount due|balance due|total due|patient (balance|responsibility|owes)|you owe|please pay|now due|pay this amount|amount you owe)\b/i],
  ['total', /\b(total charges|total|subtotal)\b/i],
  ['payment', /\b(payment|paid|adjustment|insurance)\b/i],
]);

const pad = (n) => String(n).padStart(2, '0');

function isoFrom(year, month, day) {
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(y, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

// The label that applies to a value is the last label word before it on the same line,
// so "Visit 08/30/2026 ... pay by 10/14/2026" reads as a service date and a due date.
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

// Every date on the bill, in the order it appears, with the label of the line it sits on.
export function findDates(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
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
    for (const hit of hits) found.push({ iso: hit.iso, label: labelBefore(line, hit.index, DATE_LABELS), source: line.trim() });
  }
  return found;
}

// Every dollar amount on the bill, with the label of its line.
export function findAmounts(text) {
  const found = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    for (const m of line.matchAll(/(-?)\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g)) {
      const cents = Number(m[2].replace(/,/g, '')) * 100 + Number(m[3] ?? 0);
      found.push({ cents: m[1] ? -cents : cents, label: labelBefore(line, m.index, AMOUNT_LABELS), source: line.trim() });
    }
  }
  return found;
}

export function findHospital(text) {
  const haystack = String(text ?? '').toLowerCase().replace(/\s+/g, ' ');
  for (const [alias, id] of ALIASES) {
    if (haystack.includes(alias)) return HOSPITALS.find((h) => h.id === id) ?? null;
  }
  return null;
}

function pickBillDate(dates) {
  const labeled = dates.find((d) => d.label === 'statement');
  if (labeled) return labeled;
  const notDue = dates.filter((d) => d.label !== 'due');
  if (notDue.length === 0) return null;
  // Without a label, the latest date that is not a due date is usually the statement date.
  return notDue.reduce((best, d) => (d.iso > best.iso ? d : best));
}

function pickAmountDue(amounts) {
  const positive = amounts.filter((a) => a.cents > 0);
  const due = positive.find((a) => a.label === 'due');
  if (due) return due;
  if (positive.length === 0) return null;
  return positive.reduce((best, a) => (a.cents > best.cents ? a : best));
}

export function readBill(text) {
  return Object.freeze({
    hospital: findHospital(text),
    billDate: pickBillDate(findDates(text)),
    amountDue: pickAmountDue(findAmounts(text)),
  });
}
