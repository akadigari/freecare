import { parseIsoDate } from './dates.js';
import { PROGRAM_KEYS } from './rules.js';

const PLAIN_MONEY = /^\d+(\.\d{1,2})?$/;
// Commas only in groups of three, so a typo like "95,00" is an error instead of $9,500.
const GROUPED_MONEY = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;

function parseMoney(text) {
  const cleaned = String(text ?? '').replace(/[\s$]/g, '');
  if (cleaned === '') return { value: null };
  const isValid = PLAIN_MONEY.test(cleaned) || GROUPED_MONEY.test(cleaned);
  return isValid ? { value: Number(cleaned.replace(/,/g, '')) } : { error: 'Enter an amount like 60,000.' };
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
  return size >= 1 && size <= 20
    ? { value: size }
    : { error: 'Enter how many people live in your household, from 1 to 20.' };
}

function parseResident(text) {
  if (text === 'yes') return { value: true };
  if (text === 'no') return { value: false };
  return { error: 'Pick yes or no.' };
}

function parseBillDate(text, todayIso) {
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
    firstBillDate: parseBillDate(fields.firstBillDate, todayIso),
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
