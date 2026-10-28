import { parseIsoDate } from './dates.js';
import { PROGRAM_KEYS } from './rules.js';
import { MIN_HOUSEHOLD, MAX_HOUSEHOLD } from './poverty.js';

const PLAIN_MONEY = /^\d+(\.\d{1,2})?$/;
// Commas only in groups of three, so a typo like "95,00" is an error instead of $9,500.
const GROUPED_MONEY = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;
const MONEY_ERROR = 'Enter an amount like 60,000.';

function parseMoney(text) {
  const cleaned = String(text ?? '').replace(/[\s$]/g, '');
  if (cleaned === '') return { value: null };
  if (!PLAIN_MONEY.test(cleaned) && !GROUPED_MONEY.test(cleaned)) return { error: MONEY_ERROR };
  const value = Number(cleaned.replace(/,/g, ''));
  // A number too long to represent becomes Infinity, which no rule can use.
  return Number.isFinite(value) ? { value } : { error: MONEY_ERROR };
}

function parseIncome(text) {
  const parsed = parseMoney(text);
  return parsed.value === null && !parsed.error
    ? { error: 'Enter your household income before taxes.' }
    : parsed;
}

function parseHouseholdSize(text) {
  const cleaned = String(text ?? '').trim();
  const size = WHOLE.test(cleaned) ? Number(cleaned) : Number.NaN;
  return size >= MIN_HOUSEHOLD && size <= MAX_HOUSEHOLD
    ? { value: size }
    : { error: `Enter how many people live in your household, from ${MIN_HOUSEHOLD} to ${MAX_HOUSEHOLD}.` };
}

function parseResident(text) {
  if (text === 'yes') return { value: true };
  if (text === 'no') return { value: false };
  return { error: 'Pick yes or no.' };
}

// The browser reports a half-typed date as an empty value, so the page passes a flag for it.
function parseBillDate(text, todayIso, isIncomplete) {
  if (isIncomplete) return { error: 'Finish typing the date, or clear it.' };
  if (!text) return { value: null };
  try {
    return parseIsoDate(text) > parseIsoDate(todayIso)
      ? { error: "The first bill date can't be in the future." }
      : { value: text };
  } catch (error) {
    return { error: error.message };
  }
}

// Turns the raw form fields into checker input, or explains every bad field at once.
export function parseForm(fields, todayIso) {
  const parsed = {
    householdSize: parseHouseholdSize(fields.householdSize),
    income: parseIncome(fields.income),
    resident: parseResident(fields.resident),
    firstBillDate: parseBillDate(fields.firstBillDate, todayIso, fields.firstBillDateIncomplete === true),
    medicalBills: parseMoney(fields.medicalBills),
  };
  const errors = Object.fromEntries(
    Object.entries(parsed).filter(([, field]) => field.error).map(([key, field]) => [key, field.error]),
  );
  if (Object.keys(errors).length > 0) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  return Object.freeze({
    ok: true,
    input: Object.freeze({
      householdSize: parsed.householdSize.value,
      income: parsed.income.value,
      isMarylandResident: parsed.resident.value,
      programs: Object.freeze(Object.fromEntries(PROGRAM_KEYS.map((key) => [key, fields[key] === true]))),
      firstBillDate: parsed.firstBillDate.value,
      medicalBillsLast12Months: parsed.medicalBills.value,
    }),
  });
}
