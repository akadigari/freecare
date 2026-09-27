import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoDate, daysBetween, addDays, todayIso } from '../src/dates.js';

test('parses a date-only string as UTC midnight', () => {
  assert.equal(parseIsoDate('2026-09-26'), Date.UTC(2026, 8, 26));
});

test('rejects malformed and impossible dates', () => {
  for (const bad of ['', '9/26/2026', '2026-02-30', '2026-13-01', null]) {
    assert.throws(() => parseIsoDate(bad), RangeError, String(bad));
  }
  assert.throws(() => parseIsoDate('2026-02-30'), { message: 'That date does not exist.' });
});

test('counts whole days across a daylight-saving change', () => {
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});

test('adds days and returns a date-only string', () => {
  assert.equal(addDays('2026-01-01', 240), '2026-08-29');
});

test('today uses the local calendar date, even late at night', () => {
  assert.equal(todayIso(new Date(2026, 8, 26, 23, 30)), '2026-09-26');
});
