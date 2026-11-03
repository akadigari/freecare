// A short cover letter to go with the application: the law, the household's numbers, the
// 240-day window and the 14-day clock, signed by the patient. Built from what the page
// already knows; lines with nothing behind them are left out rather than printed blank.

import { TIERS, APPLICATION_WINDOW_DAYS } from './rules.js';
import { addDays } from './dates.js';
import { POVERTY_GUIDELINES } from './poverty.js';
import { formatPercent } from './present.js';
import { LETTER } from './strings.js';

export const LETTER_FILE = 'freecare-cover-letter.txt';
const DECISION_DAYS = 14;

const clean = (value) => String(value ?? '').trim();
// "Holy Cross Health (Silver Spring, Germantown)" is addressed as "Holy Cross Health".
const shortName = (name) => clean(name).replace(/\s*\([^)]*\)\s*$/, '');

export function coverLetter({ who = {}, hospitalName = '', result, todayIso, lang = 'en' }) {
  const T = LETTER[lang] ?? LETTER.en;
  const longDate = new Intl.DateTimeFormat(T.locale, { dateStyle: 'long', timeZone: 'UTC' });
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const date = (iso) => longDate.format(new Date(`${iso}T00:00:00Z`));
  const ask = result.tier === TIERS.FREE ? T.askFree : result.tier === TIERS.REDUCED ? T.askCut(result.discount) : T.askReview;
  const paragraphs = [
    date(todayIso),
    shortName(hospitalName) ? T.toHospital(shortName(hospitalName)) : T.toOffice,
    T.applying,
    T.numbers(result.householdSize, money.format(result.income), formatPercent(result.percentOfPovertyLine), POVERTY_GUIDELINES.year, ask),
    result.deadline ? T.firstBill(date(addDays(result.deadline.deadline, -APPLICATION_WINDOW_DAYS)), APPLICATION_WINDOW_DAYS) : null,
    T.clock(DECISION_DAYS),
    T.thanks,
  ].filter(Boolean);
  const address = [clean(who.street), clean(who.unit)].filter(Boolean).join(', ');
  const cityLine = [clean(who.city), [clean(who.city) ? 'MD' : '', clean(who.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const signature = [clean(who.name), address, cityLine, clean(who.phone)].filter(Boolean).join('\n');
  return `${paragraphs.join('\n\n')}\n\n${signature}`;
}
