// The counselor's record: what was entered, what the page said, when, and under which version
// of the rules. Plain text, printed or saved at the desk. Built the way letter.js builds the
// cover letter: lines with nothing behind them are left out rather than printed blank.

import { RULES, exemptionsById } from './workrule.js';
import { WORKRULE, RECORD } from './strings.js';

export const RECORD_FILE = 'medicaid-proof-record.txt';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const clean = (value) => String(value ?? '').trim();

function words(lang) {
  const T = RECORD[lang] ?? RECORD.en;
  const W = WORKRULE[lang] ?? WORKRULE.en;
  const day = new Intl.DateTimeFormat(T.locale, { dateStyle: 'long', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat(T.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
  return {
    T,
    W,
    date: (iso) => day.format(new Date(`${iso}T00:00:00Z`)),
    monthName: (ym) => (/^\d{4}-\d{2}$/.test(String(ym ?? '')) ? month.format(new Date(`${ym}-01T00:00:00Z`)) : String(ym ?? '')),
  };
}

// "2027-01-12T15:04:00-05:00" prints as the day and the clock time as typed, in the device's zone.
function stamp(nowIso, date) {
  const text = clean(nowIso);
  const day = text.slice(0, 10);
  const clock = text.slice(11, 16);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${date(day)}${clock ? `, ${clock}` : ''}` : text;
}

export function jobLine(job, lang = 'en') {
  const { T, date } = words(lang);
  let line = `${clean(job.employer) || T.unnamedJob}: ${money.format((job.grossCents ?? 0) / 100)} ${T.gross}, ${job.hours ?? 0} ${T.hours}`;
  if (job.payDate) line += `, ${T.paid} ${date(job.payDate)}`;
  if (job.periodStart && job.periodEnd) line += ` ${T.for} ${date(job.periodStart)} ${T.to} ${date(job.periodEnd)}`;
  else if (job.periodStart) line += ` ${T.from} ${date(job.periodStart)}`;
  else if (job.periodEnd) line += ` ${T.to} ${date(job.periodEnd)}`;
  return line;
}

// "work 80, volunteering 12": the activities with hours, zeros dropped.
export function hoursBreakdown(model, lang = 'en') {
  const { T } = words(lang);
  const other = model.otherHours ?? {};
  const parts = [['work', model.test?.jobHours ?? 0], ['school', other.school], ['training', other.training], ['volunteer', other.volunteer]]
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([key, n]) => `${T.short[key]} ${n}`);
  return parts.join(', ');
}

export function meetsLine(model, lang = 'en') {
  const { T, W } = words(lang);
  const result = model.test;
  if (!result?.met) return W.belowAll;
  const detail = result.met === 'earnings' ? ` (${money.format(result.grossCents / 100)})` : result.met === 'hours' ? ` (${result.hoursTotal} ${T.hours})` : '';
  return `${T.meets}: ${W.test[result.met]}${detail}`;
}

export function counselorRecord({ model, nowIso, lang = 'en' }) {
  const { T, W, date, monthName } = words(lang);
  const who = model.who ?? {};
  const member = [clean(who.name), clean(who.caseNumber) ? `(${T.caseNo} ${clean(who.caseNumber)})` : ''].filter(Boolean).join(' ');
  const jobs = (model.jobs ?? []).map((job) => `- ${jobLine(job, lang)}`);
  const exemptions = exemptionsById(model.exemptions).map((e) => `- ${W.exemption[e.id]}`);
  const attachments = (model.attachments ?? []).map((a, i) => `${i + 1}. ${clean(a.label) || T.unnamedFile} (${a.kind})`);
  const total = model.test?.hoursTotal ?? 0;
  const breakdown = hoursBreakdown(model, lang);
  const blocks = [
    T.title,
    `${T.when}: ${stamp(nowIso, date)}`,
    T.rulesChecked(RULES.verified, RULES.source),
    model.month ? `${T.month}: ${monthName(model.month)}` : null,
    member ? `${T.member}: ${member}` : null,
    jobs.length ? [`${T.jobs}:`, ...jobs].join('\n') : null,
    `${T.hoursLine}: ${total} ${T.hours}${breakdown ? ` (${breakdown})` : ''}`,
    model.halfTimeSchool ? T.halfTime : null,
    meetsLine(model, lang),
    exemptions.length ? [`${T.exemptions}:`, ...exemptions].join('\n') : null,
    attachments.length ? [`${T.attachments}:`, ...attachments].join('\n') : null,
    model.workStatement ? T.statement : null,
    W.decides,
    T.footer,
  ].filter(Boolean);
  return blocks.join('\n\n');
}
