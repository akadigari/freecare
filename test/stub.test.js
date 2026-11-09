import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStubDates, findHours, findGross, findEmployer, readStub } from '../src/stub.js';

const STUB_A = `Blue Crab Diner LLC
Employee: Dana Example
Pay Period: 12/22/2026 - 01/04/2027   Pay Date: 01/09/2027
Earnings      Rate    Hours    Current     YTD
Regular       15.50   74.00    1,147.00    1,147.00
Overtime      23.25    6.00      139.50      139.50
Gross Pay                       $1,286.50  $1,286.50
Federal Tax                       -98.20
Net Pay                         $1,061.12`;

const STUB_B = `ACME HOME HEALTH SERVICES
Statement of Earnings
Period Start 01/01/2027  Period End 01/15/2027
Check Date Jan 20, 2027
Hours Worked 42.5
Total Earnings $637.50
Year to Date $637.50`;

const STUB_C = `Cash receipt
Lawn work for Mr. Reyes
Paid $240 on 1/16/2027`;

test('a two-week stub: period dates, pay date, hours by label, gross not net or ytd', () => {
  const dates = findStubDates(STUB_A);
  assert.deepEqual(dates.map((d) => [d.iso, d.label]), [['2026-12-22', 'start'], ['2027-01-04', 'end'], ['2027-01-09', 'pay']]);
  const hours = findHours(STUB_A);
  assert.deepEqual(hours.map((h) => [h.hours, h.label]), [[74, 'regular'], [6, 'overtime']]);
  const gross = findGross(STUB_A);
  assert.ok(gross.some((g) => g.cents === 128650 && g.label === 'gross'));
  assert.ok(gross.some((g) => g.cents === 106112 && g.label === 'net'));
  assert.equal(findEmployer(STUB_A), 'Blue Crab Diner LLC');
  const read = readStub(STUB_A);
  assert.equal(read.employer.value, 'Blue Crab Diner LLC');
  assert.equal(read.payDate.value, '2027-01-09');
  assert.equal(read.periodStart.value, '2026-12-22');
  assert.equal(read.periodEnd.value, '2027-01-04');
  assert.equal(read.hours.value, 80, 'regular plus overtime when there is no total line');
  assert.equal(read.grossCents.value, 128650);
  assert.match(read.grossCents.source, /Gross Pay/);
});

test('a stub with written labels and a month-name check date', () => {
  const read = readStub(STUB_B);
  assert.equal(read.employer.value, 'ACME HOME HEALTH SERVICES');
  assert.equal(read.payDate.value, '2027-01-20');
  assert.equal(read.periodStart.value, '2027-01-01');
  assert.equal(read.periodEnd.value, '2027-01-15');
  assert.equal(read.hours.value, 42.5);
  assert.equal(read.grossCents.value, 63750, 'Total Earnings is gross; Year to Date is skipped');
});

test('a cash receipt gives an amount and a date and nothing else, never a guess', () => {
  const read = readStub(STUB_C);
  assert.equal(read.grossCents.value, 24000);
  assert.equal(read.payDate.value, '2027-01-16');
  assert.equal(read.hours, null);
  assert.equal(read.periodStart, null);
  assert.equal(read.periodEnd, null);
  assert.equal(read.employer, null, 'no company word on any line');
});

test('empty or garbage text reads as all nulls', () => {
  for (const text of ['', null, 'asdf 123 !!!']) {
    const read = readStub(text);
    for (const key of ['employer', 'payDate', 'periodStart', 'periodEnd', 'hours', 'grossCents']) assert.equal(read[key], null, `${JSON.stringify(text)} ${key}`);
    assert.ok(Object.isFrozen(read));
  }
});
