const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Date-only strings are handled as UTC midnight so day counts never shift
// across daylight-saving changes or time zones.
export function parseIsoDate(iso) {
  const match = typeof iso === 'string' ? ISO_DATE.exec(iso) : null;
  if (!match) throw new RangeError('Dates must look like 2026-09-26.');
  const [year, month, day] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError('That date does not exist.');
  }
  return ms;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / MS_PER_DAY);
}

export function addDays(iso, days) {
  return new Date(parseIsoDate(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
