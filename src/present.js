import { POVERTY_GUIDELINES } from './poverty.js';
import { TIERS, APPLICATION_WINDOW_DAYS } from './rules.js';

export const SOURCES = Object.freeze([
  { label: 'Maryland Health-General § 19-214.1', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&enactments=false&section=19-214.1' },
  { label: 'COMAR 10.37.13.06', url: 'https://regs.maryland.gov/us/md/exec/comar/10.37.13.06' },
  { label: 'HHS 2026 poverty guidelines', url: POVERTY_GUIDELINES.sourceUrl },
].map(Object.freeze));

const PROGRAM_NAMES = Object.freeze({
  snap: 'SNAP',
  wic: 'WIC',
  energyAssistance: 'Maryland Energy Assistance',
  schoolMeals: 'free or reduced-price school meals',
});

const BRING = Object.freeze([
  "Proof of income, like pay stubs or last year's tax return",
  'Something that shows who lives in your household',
  'Your hospital bill',
]);

const NOTES = Object.freeze([
  'This is an estimate. The hospital makes the final decision.',
  'Hospitals can be more generous than this.',
  'Some hospitals also look at your savings.',
  'Every Maryland hospital uses the same financial assistance application.',
  'This is a guide, not legal advice.',
]);

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

// Rounds up to one decimal so an income just over a cutoff never reads as "at" the cutoff.
export function formatPercent(percent) {
  const roundedUp = Math.ceil(Number((percent * 10).toFixed(6))) / 10;
  return `${Number.isInteger(roundedUp) ? roundedUp : roundedUp.toFixed(1)}%`;
}

function joinNames(keys) {
  const names = keys.map((key) => PROGRAM_NAMES[key]);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function headlineFor({ tier, discount, medicalBillsLast12Months, percentOfPovertyLine }) {
  if (tier === TIERS.FREE) return 'Your care should be free.';
  if (tier === TIERS.REDUCED) return `Your bill should be cut by ${discount}%.`;
  const hardshipStillPossible = medicalBillsLast12Months === null && percentOfPovertyLine <= 500;
  if (tier === TIERS.NOT_REQUIRED && hardshipStillPossible) {
    return 'You may qualify for 35% to 50% off if your medical bills are high.';
  }
  if (tier === TIERS.NOT_REQUIRED) return "Maryland law doesn't require a discount at your income. Ask anyway.";
  return "Maryland's rule is for Maryland residents. Check the hospital's own policy.";
}

function detailFor(result) {
  const { tier, presumptivePrograms, percentOfPovertyLine, hardship, householdSize, medicalBillsLast12Months } = result;
  const math = `Your household income of ${money.format(result.income)} is ${formatPercent(percentOfPovertyLine)} of the ${POVERTY_GUIDELINES.year} `
    + `federal poverty line (${money.format(result.povertyLine)} for a household of ${householdSize}).`;
  if (tier === TIERS.NOT_COVERED) {
    return "Maryland's free and reduced-cost care rules cover Maryland residents. "
      + `Many hospitals still help other patients through their own financial assistance policy. ${math}`;
  }
  if (presumptivePrograms.length > 0) {
    return `Because you get ${joinNames(presumptivePrograms)}, you automatically qualify for free care, whatever your income. ${math}`;
  }
  if (tier === TIERS.FREE) {
    return `${math} At or below 200%, Maryland hospitals have to give medically necessary care for free.`;
  }
  if (tier === TIERS.REDUCED && hardship && percentOfPovertyLine > 300) {
    return `${math} Because your medical bills from the last 12 months are more than 25% of your income, `
      + 'Maryland hospitals have to cut what you owe.';
  }
  if (tier === TIERS.REDUCED) return `${math} Between 200% and 300%, Maryland hospitals have to cut what you owe.`;
  if (percentOfPovertyLine <= 500 && medicalBillsLast12Months !== null) {
    return `${math} Your medical bills from the last 12 months are not more than 25% of your income, `
      + "so the hardship discount doesn't apply.";
  }
  if (percentOfPovertyLine <= 500) {
    return `${math} If your medical bills from the last 12 months are more than 25% of your income, `
      + 'you may qualify for a hardship discount of 35% to 50%.';
  }
  return `${math} Above 500%, the state rule doesn't require a discount, but many hospitals have their own programs.`;
}

function deadlineTextFor(deadline) {
  if (!deadline) return `You have ${APPLICATION_WINDOW_DAYS} days from your first bill to apply.`;
  if (!deadline.isOpen) {
    return `It's been more than ${APPLICATION_WINDOW_DAYS} days since your first bill. Ask the hospital anyway, some still help.`;
  }
  if (deadline.daysLeft === 0) return 'Today is the last day to apply.';
  const days = deadline.daysLeft === 1 ? '1 day' : `${deadline.daysLeft} days`;
  return `You have ${days} left to apply. The deadline is ${longDate.format(new Date(`${deadline.deadline}T00:00:00Z`))}.`;
}

// A few words the page stamps across the result, like a rubber stamp on a bill.
function stampFor({ tier, discount }) {
  if (tier === TIERS.FREE) return 'FREE';
  if (tier === TIERS.REDUCED) return `${discount}% OFF`;
  if (tier === TIERS.NOT_COVERED) return 'NOT COVERED';
  return 'ASK ANYWAY';
}

export function describe(result) {
  const programProof = result.presumptivePrograms.length > 0
    ? [`Proof you get ${joinNames(result.presumptivePrograms)}`]
    : [];
  return Object.freeze({
    stamp: stampFor(result),
    headline: headlineFor(result),
    detail: detailFor(result),
    deadlineText: deadlineTextFor(result.deadline),
    bring: Object.freeze([...BRING, ...programProof]),
    notes: NOTES,
    sources: SOURCES,
  });
}
