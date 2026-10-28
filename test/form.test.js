import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseForm } from '../src/form.js';

const TODAY = '2026-09-26';
const fields = (overrides = {}) => ({
  householdSize: '4', income: '60000', resident: 'yes',
  snap: false, wic: false, energyAssistance: false, schoolMeals: false,
  firstBillDate: '', medicalBills: '', ...overrides,
});

test('turns form text into checker input', () => {
  const result = parseForm(fields({ firstBillDate: '2026-09-01', medicalBills: '2,500' }), TODAY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.input, {
    householdSize: 4, income: 60000, isMarylandResident: true,
    programs: { snap: false, wic: false, energyAssistance: false, schoolMeals: false },
    firstBillDate: '2026-09-01', medicalBillsLast12Months: 2500,
  });
});

test('accepts dollar signs, commas, spaces and cents in money', () => {
  assert.equal(parseForm(fields({ income: ' $60,000.50 ' }), TODAY).input.income, 60000.5);
});

test('blank optional fields become null', () => {
  const { input } = parseForm(fields(), TODAY);
  assert.equal(input.firstBillDate, null);
  assert.equal(input.medicalBillsLast12Months, null);
});

test('explains every bad field at once', () => {
  const result = parseForm(fields({
    householdSize: '4.5', income: 'lots', resident: '', firstBillDate: '2026-12-01', medicalBills: '-3',
  }), TODAY);
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(),
    ['firstBillDate', 'householdSize', 'income', 'medicalBills', 'resident']);
});

test('household size must be a whole number from 1 to 20', () => {
  for (const bad of ['0', '21', '', 'four']) {
    assert.equal(parseForm(fields({ householdSize: bad }), TODAY).ok, false, bad);
  }
});

test('missing income is an error with a clear message', () => {
  assert.equal(parseForm(fields({ income: '' }), TODAY).errors.income, 'Enter your household income before taxes.');
});

test('an impossible date is an error, not a crash', () => {
  assert.equal(parseForm(fields({ firstBillDate: '2026-02-30' }), TODAY).errors.firstBillDate, 'That date does not exist.');
});

test('commas must be in groups of three, so "95,00" is not read as $9,500', () => {
  for (const typo of ['95,00', '1,2,3', '60,00,0']) {
    const result = parseForm(fields({ income: typo }), TODAY);
    assert.equal(result.ok, false, typo);
    assert.equal(result.errors.income, 'Enter an amount like 60,000.', typo);
  }
  for (const [typed, value] of [['60,000', 60000], ['1,234,567', 1234567], ['60000', 60000], ['$60,000.50', 60000.5]]) {
    assert.equal(parseForm(fields({ income: typed }), TODAY).input.income, value, typed);
  }
});

test('huge numbers are an error, not Infinity', () => {
  const huge = '9'.repeat(400);
  const result = parseForm(fields({ income: huge, medicalBills: huge }), TODAY);
  assert.equal(result.ok, false);
  assert.equal(result.errors.income, 'Enter an amount like 60,000.');
  assert.equal(result.errors.medicalBills, 'Enter an amount like 60,000.');
});

test('a half-typed bill date is an error, not silently blank', () => {
  assert.equal(parseForm(fields({ firstBillDateIncomplete: true }), TODAY).errors.firstBillDate,
    'Finish typing the date, or clear it.');
});
