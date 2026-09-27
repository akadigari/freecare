import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe as describeResult, formatPercent } from '../src/present.js';
import { checkEligibility } from '../src/rules.js';

const TODAY = '2026-09-26';
const view = (overrides = {}) => describeResult(checkEligibility({
  householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
  firstBillDate: null, medicalBillsLast12Months: null, ...overrides,
}, TODAY));

test('headline for each outcome', () => {
  assert.equal(view().headline, 'Your care should be free.');
  assert.equal(view({ income: 70000 }).headline, 'Your bill should be cut by 75%.');
  assert.equal(view({ income: 200000 }).headline, "Maryland law doesn't require a discount at your income. Ask anyway.");
  assert.equal(view({ isMarylandResident: false }).headline, "Maryland's rule is for Maryland residents. Check the hospital's own policy.");
});

test('percent never looks lower than the tier it lands in', () => {
  assert.equal(formatPercent(200), '200%');
  assert.equal(formatPercent(200.003), '200.1%');
  assert.equal(formatPercent(181.818), '181.9%');
  assert.equal(formatPercent(0), '0%');
});

test('detail explains the math with the real poverty line', () => {
  assert.equal(view().detail,
    'Your household income of $60,000 is 181.9% of the 2026 federal poverty line ($33,000 for a household of 4). '
    + 'At or below 200%, Maryland hospitals have to give medically necessary care for free.');
  assert.match(view({ income: 70000 }).detail, /Between 200% and 300%, Maryland hospitals have to cut what you owe\./);
});

test('program detail names the programs', () => {
  assert.equal(view({ income: 200000, programs: { snap: true, wic: true } }).detail,
    'Because you get SNAP and WIC, you automatically qualify for free care.');
});

test('hardship and near-hardship explanations', () => {
  assert.match(view({ income: 110000, medicalBillsLast12Months: 40000 }).detail, /more than 25% of your income/);
  assert.match(view({ income: 110000 }).detail, /may qualify for a hardship discount of 35% to 50%/);
  assert.match(view({ income: 200000 }).detail, /Above 500%/);
});

test('deadline text', () => {
  assert.equal(view().deadlineText, 'You have 240 days from your first bill to apply.');
  assert.equal(view({ firstBillDate: '2026-09-01' }).deadlineText,
    'You have 215 days left to apply. The deadline is April 29, 2027.');
  assert.equal(view({ firstBillDate: '2026-01-29' }).deadlineText, 'Today is the last day to apply.');
  assert.equal(view({ firstBillDate: '2026-01-28' }).deadlineText,
    "It's been more than 240 days since your first bill. Ask the hospital anyway, some still help.");
});

test('what to bring adds proof of programs', () => {
  assert.equal(view().bring.length, 3);
  assert.equal(view({ programs: { snap: true } }).bring.at(-1), 'Proof you get SNAP');
});

test('always cites the law and says it is not legal advice', () => {
  const result = view();
  assert.equal(result.sources.length, 3);
  assert.ok(result.notes.includes('This is a guide, not legal advice.'));
  assert.ok(Object.isFrozen(result));
});

test('detail shows the income it used, so a misread is easy to spot', () => {
  assert.match(view({ income: 9500 }).detail, /Your household income of \$9,500 is /);
});

test('blank medical bills between 300% and 500% get a hopeful headline, not a firm no', () => {
  assert.equal(view({ income: 110000 }).headline, 'You may qualify for 35% to 50% off if your medical bills are high.');
  assert.equal(view({ income: 110000, medicalBillsLast12Months: 10000 }).headline,
    "Maryland law doesn't require a discount at your income. Ask anyway.");
  assert.equal(view({ income: 200000 }).headline, "Maryland law doesn't require a discount at your income. Ask anyway.");
});
