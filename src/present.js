import { POVERTY_GUIDELINES } from './poverty.js';
import { TIERS, APPLICATION_WINDOW_DAYS } from './rules.js';
import { RESULT } from './strings.js';

const SOURCE_URLS = Object.freeze([
  'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&enactments=false&section=19-214.1',
  'https://regs.maryland.gov/us/md/exec/comar/10.37.13.06',
  POVERTY_GUIDELINES.sourceUrl,
]);

export const SOURCES = Object.freeze(RESULT.en.sourceLabels.map((label, i) => Object.freeze({ label, url: SOURCE_URLS[i] })));

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Rounds up to one decimal so an income just over a cutoff never reads as "at" the cutoff.
export function formatPercent(percent) {
  const roundedUp = Math.ceil(Number((percent * 10).toFixed(6))) / 10;
  return `${Number.isInteger(roundedUp) ? roundedUp : roundedUp.toFixed(1)}%`;
}

function headlineFor(T, { tier, discount, medicalBillsLast12Months, percentOfPovertyLine }) {
  if (tier === TIERS.FREE) return T.headline.free;
  if (tier === TIERS.REDUCED) return T.headline.reduced(discount);
  const hardshipStillPossible = medicalBillsLast12Months === null && percentOfPovertyLine <= 500;
  if (tier === TIERS.NOT_REQUIRED && hardshipStillPossible) return T.headline.hardshipPossible;
  if (tier === TIERS.NOT_REQUIRED) return T.headline.notRequired;
  return T.headline.notCovered;
}

function detailFor(T, result) {
  const { tier, presumptivePrograms, percentOfPovertyLine, hardship, householdSize, medicalBillsLast12Months } = result;
  const math = T.math(money.format(result.income), formatPercent(percentOfPovertyLine), POVERTY_GUIDELINES.year, money.format(result.povertyLine), householdSize);
  if (tier === TIERS.NOT_COVERED) return T.detail.notCovered(math);
  if (presumptivePrograms.length > 0) return T.detail.programs(T.programs(presumptivePrograms), math);
  if (tier === TIERS.FREE) return T.detail.free(math);
  if (tier === TIERS.REDUCED && hardship && percentOfPovertyLine > 300) return T.detail.reducedHardship(math);
  if (tier === TIERS.REDUCED) return T.detail.reduced(math);
  if (percentOfPovertyLine <= 500 && medicalBillsLast12Months !== null) return T.detail.noHardship(math);
  if (percentOfPovertyLine <= 500) return T.detail.maybeHardship(math);
  return T.detail.above(math);
}

function deadlineTextFor(T, deadline) {
  if (!deadline) return T.deadline.none(APPLICATION_WINDOW_DAYS);
  if (!deadline.isOpen) return T.deadline.closed(APPLICATION_WINDOW_DAYS);
  if (deadline.daysLeft === 0) return T.deadline.today;
  const longDate = new Intl.DateTimeFormat(T.locale, { dateStyle: 'long', timeZone: 'UTC' });
  return T.deadline.left(deadline.daysLeft, longDate.format(new Date(`${deadline.deadline}T00:00:00Z`)));
}

// A few words the page stamps across the result, like a rubber stamp on a bill.
function stampFor(T, { tier, discount }) {
  if (tier === TIERS.FREE) return T.stamp.free;
  if (tier === TIERS.REDUCED) return T.stamp.reduced(discount);
  if (tier === TIERS.NOT_COVERED) return T.stamp.notCovered;
  return T.stamp.askAnyway;
}

// Plain-language version of a result, in English or Spanish.
export function describe(result, lang = 'en') {
  const T = RESULT[lang] ?? RESULT.en;
  const programProof = result.presumptivePrograms.length > 0 ? [T.proof(T.programs(result.presumptivePrograms))] : [];
  return Object.freeze({
    stamp: stampFor(T, result),
    headline: headlineFor(T, result),
    detail: detailFor(T, result),
    deadlineText: deadlineTextFor(T, result.deadline),
    bring: Object.freeze([...T.bring, ...programProof]),
    notes: Object.freeze([...T.notes]),
    sources: Object.freeze(T.sourceLabels.map((label, i) => Object.freeze({ label, url: SOURCE_URLS[i] }))),
  });
}
