import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POVERTY_GUIDELINES, povertyLine, percentOfPovertyLine } from '../src/poverty.js';

test('matches the HHS 2026 table for sizes 1 to 8', () => {
  const table = [15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720];
  table.forEach((amount, index) => assert.equal(povertyLine(index + 1), amount));
});

test('adds $5,680 for each person past 8', () => {
  assert.equal(povertyLine(9), 61400);
  assert.equal(povertyLine(12), 78440);
});

test('pins the guideline year and source', () => {
  assert.equal(POVERTY_GUIDELINES.year, 2026);
  assert.equal(POVERTY_GUIDELINES.published, '2026-01-15');
  assert.ok(Object.isFrozen(POVERTY_GUIDELINES));
});

test('rejects household sizes that are not whole numbers from 1 to 20', () => {
  for (const bad of [0, -1, 21, 2.5, Number.NaN, '4', null]) {
    assert.throws(() => povertyLine(bad), RangeError, String(bad));
  }
});

test('computes income as a percent of the poverty line', () => {
  assert.equal(percentOfPovertyLine(66000, 4), 200);
  assert.equal(percentOfPovertyLine(0, 1), 0);
});

test('rejects negative or non-numeric income', () => {
  for (const bad of [-1, Number.NaN, Infinity, '60000', null]) {
    assert.throws(() => percentOfPovertyLine(bad, 4), RangeError, String(bad));
  }
});
