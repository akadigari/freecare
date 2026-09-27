// Maryland Health-General 19-214.1 and COMAR 10.37.13.06.
import { povertyLine, percentOfPovertyLine } from './poverty.js';
import { addDays, daysBetween } from './dates.js';

export const TIERS = Object.freeze({
  FREE: 'free',
  REDUCED: 'reduced',
  NOT_REQUIRED: 'not_required',
  NOT_COVERED: 'not_covered',
});

export const PROGRAM_KEYS = Object.freeze(['snap', 'wic', 'energyAssistance', 'schoolMeals']);
export const FREE_CARE_LIMIT = 200;
export const HARDSHIP_SHARE = 0.25;
export const APPLICATION_WINDOW_DAYS = 240;

// Over the previous cutoff, up to and including maxPercent.
const STANDARD_BANDS = Object.freeze([
  { maxPercent: 250, discount: 75 },
  { maxPercent: 300, discount: 60 },
].map(Object.freeze));

// Only for patients with financial hardship (COMAR 10.37.13.06).
const HARDSHIP_BANDS = Object.freeze([
  { maxPercent: 350, discount: 50 },
  { maxPercent: 400, discount: 45 },
  { maxPercent: 450, discount: 40 },
  { maxPercent: 500, discount: 35 },
].map(Object.freeze));

function assertAmount(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a number that is 0 or more.`);
  }
}

export function hasHardship(medicalBills, income) {
  if (medicalBills === null || medicalBills === undefined) return false;
  assertAmount(medicalBills, 'Medical bills');
  assertAmount(income, 'Income');
  return medicalBills > income * HARDSHIP_SHARE;
}

export function discountFor(income, householdSize, hardship) {
  assertAmount(income, 'Income');
  const line = povertyLine(householdSize);
  const limit = (percent) => (line * percent) / 100;
  if (income <= limit(FREE_CARE_LIMIT)) return Object.freeze({ tier: TIERS.FREE, discount: 100 });
  const bands = hardship ? [...STANDARD_BANDS, ...HARDSHIP_BANDS] : STANDARD_BANDS;
  const band = bands.find((candidate) => income <= limit(candidate.maxPercent));
  return band
    ? Object.freeze({ tier: TIERS.REDUCED, discount: band.discount })
    : Object.freeze({ tier: TIERS.NOT_REQUIRED, discount: 0 });
}

export function applicationDeadline(firstBillIso, todayIso) {
  const daysSinceBill = daysBetween(firstBillIso, todayIso);
  if (daysSinceBill < 0) throw new RangeError('The first bill date cannot be in the future.');
  return Object.freeze({
    deadline: addDays(firstBillIso, APPLICATION_WINDOW_DAYS),
    daysSinceBill,
    daysLeft: Math.max(APPLICATION_WINDOW_DAYS - daysSinceBill, 0),
    isOpen: daysSinceBill <= APPLICATION_WINDOW_DAYS,
  });
}

export function checkEligibility(input, todayIso) {
  const {
    householdSize, income, isMarylandResident, programs = {},
    firstBillDate = null, medicalBillsLast12Months = null,
  } = input;
  if (typeof isMarylandResident !== 'boolean') throw new TypeError('Say whether you live in Maryland.');
  const percent = percentOfPovertyLine(income, householdSize);
  const presumptivePrograms = Object.freeze(PROGRAM_KEYS.filter((key) => programs[key] === true));
  const hardship = hasHardship(medicalBillsLast12Months, income);
  const shared = {
    householdSize,
    income,
    povertyLine: povertyLine(householdSize),
    percentOfPovertyLine: percent,
    presumptivePrograms,
    medicalBillsLast12Months,
    hardship,
    deadline: firstBillDate ? applicationDeadline(firstBillDate, todayIso) : null,
  };
  if (!isMarylandResident) return Object.freeze({ ...shared, tier: TIERS.NOT_COVERED, discount: 0 });
  if (presumptivePrograms.length > 0) return Object.freeze({ ...shared, tier: TIERS.FREE, discount: 100 });
  return Object.freeze({ ...shared, ...discountFor(income, householdSize, hardship) });
}
