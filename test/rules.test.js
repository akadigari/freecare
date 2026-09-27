import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEligibility, hasHardship, applicationDeadline, TIERS, PROGRAM_KEYS } from '../src/rules.js';

const TODAY = '2026-09-26';
const check = (overrides = {}) => checkEligibility({
  householdSize: 4,
  income: 60000,
  isMarylandResident: true,
  programs: {},
  firstBillDate: null,
  medicalBillsLast12Months: null,
  ...overrides,
}, TODAY);

test('spec examples for a family of 4: $60K, $70K, $95K', () => {
  const results = [60000, 70000, 95000].map((income) => check({ income }));
  assert.deepEqual(results.map((r) => [r.tier, r.discount]), [
    [TIERS.FREE, 100], [TIERS.REDUCED, 75], [TIERS.REDUCED, 60],
  ]);
});

test('every standard cutoff for a family of 4 (poverty line $33,000)', () => {
  const cases = [
    [66000, TIERS.FREE, 100], [66001, TIERS.REDUCED, 75],
    [82500, TIERS.REDUCED, 75], [82501, TIERS.REDUCED, 60],
    [99000, TIERS.REDUCED, 60], [99001, TIERS.NOT_REQUIRED, 0],
  ];
  for (const [income, tier, discount] of cases) {
    const result = check({ income });
    assert.equal(result.tier, tier, `income ${income}`);
    assert.equal(result.discount, discount, `income ${income}`);
  }
});

test('hardship cutoffs between 300% and 500%', () => {
  const heavyBills = { medicalBillsLast12Months: 1_000_000 };
  const cases = [
    [99001, 50], [115500, 50], [115501, 45], [132000, 45],
    [132001, 40], [148500, 40], [148501, 35], [165000, 35],
  ];
  for (const [income, discount] of cases) {
    assert.equal(check({ income, ...heavyBills }).discount, discount, `income ${income}`);
  }
  assert.equal(check({ income: 165001, ...heavyBills }).tier, TIERS.NOT_REQUIRED);
});

test('without hardship there is no required discount above 300%', () => {
  assert.equal(check({ income: 115000 }).tier, TIERS.NOT_REQUIRED);
});

test('hardship means medical bills above 25% of income, not equal to it', () => {
  assert.equal(hasHardship(15000, 60000), false);
  assert.equal(hasHardship(15001, 60000), true);
  assert.equal(hasHardship(null, 60000), false);
  assert.equal(hasHardship(1, 0), true);
});

test('each program alone makes care free at any income', () => {
  for (const key of PROGRAM_KEYS) {
    const result = check({ income: 500000, programs: { [key]: true } });
    assert.equal(result.tier, TIERS.FREE, key);
    assert.deepEqual(result.presumptivePrograms, [key]);
  }
});

test('income of 0 is free care', () => {
  assert.equal(check({ income: 0 }).tier, TIERS.FREE);
});

test('non-residents are outside the state rule, even with SNAP', () => {
  const result = check({ isMarylandResident: false, programs: { snap: true } });
  assert.equal(result.tier, TIERS.NOT_COVERED);
  assert.equal(result.discount, 0);
});

test('bad inputs throw clear errors', () => {
  assert.throws(() => check({ householdSize: 0 }), RangeError);
  assert.throws(() => check({ income: -5 }), RangeError);
  assert.throws(() => check({ income: Number.NaN }), RangeError);
  assert.throws(() => check({ isMarylandResident: 'yes' }), TypeError);
  assert.throws(() => check({ firstBillDate: '2026-10-01' }), RangeError);
});

test('the 240-day window: day 240 is open, day 241 is closed', () => {
  assert.deepEqual(applicationDeadline('2026-01-29', TODAY), {
    deadline: '2026-09-26', daysSinceBill: 240, daysLeft: 0, isOpen: true,
  });
  assert.deepEqual(applicationDeadline('2026-01-28', TODAY), {
    deadline: '2026-09-25', daysSinceBill: 241, daysLeft: 0, isOpen: false,
  });
});

test('result is frozen and carries the numbers the page needs', () => {
  const result = check({ firstBillDate: '2026-09-01' });
  assert.ok(Object.isFrozen(result));
  assert.equal(result.povertyLine, 33000);
  assert.equal(result.householdSize, 4);
  assert.equal(result.deadline.daysLeft, 215);
  assert.equal(result.deadline.deadline, '2027-04-29');
});
