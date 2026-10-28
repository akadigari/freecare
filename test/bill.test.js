import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBill, findDates, findAmounts, findHospital } from '../src/bill.js';

const SAMPLE = `
MEDSTAR UNION MEMORIAL HOSPITAL
201 E University Pkwy, Baltimore MD 21218
PATIENT STATEMENT
Statement Date: 09/14/2026        Account #: 00482913
Patient: DANA EXAMPLE
Date of Service    Description              Charges
08/30/2026         Emergency room visit     $2,480.00
08/30/2026         Lab work                 $312.50
                   Insurance payments       -$0.00
Amount Due: $2,792.50
Please pay by 10/14/2026
`;

test('dates are found with their labels, in ISO form', () => {
  const dates = findDates(SAMPLE);
  assert.deepEqual(dates.map((d) => d.iso), ['2026-09-14', '2026-08-30', '2026-08-30', '2026-10-14']);
  assert.equal(dates[0].label, 'statement');
  assert.equal(dates[3].label, 'due');
  assert.equal(findDates('Statement date: September 3, 2026')[0].iso, '2026-09-03');
  assert.equal(findDates('Bill date 9/3/26')[0].iso, '2026-09-03');
  assert.deepEqual(findDates('no dates here 13/45/2026'), []);
});

test('the bill date is the labeled statement date, never the due date', () => {
  assert.equal(readBill(SAMPLE).billDate.iso, '2026-09-14');
  const noLabel = readBill('Visit 08/30/2026 total $100.00 pay by 10/14/2026');
  assert.equal(noLabel.billDate.iso, '2026-08-30');
  assert.equal(readBill('nothing useful').billDate, null);
});

test('amounts are found and the amount due wins over line items', () => {
  const amounts = findAmounts(SAMPLE);
  assert.ok(amounts.some((a) => a.cents === 279250 && a.label === 'due'));
  assert.equal(readBill(SAMPLE).amountDue.cents, 279250);
  assert.equal(readBill('Total charges $1,200.00 and a copay of $40').amountDue.cents, 120000, 'largest amount when nothing is labeled');
  assert.equal(readBill('no money here').amountDue, null);
});

test('the hospital is matched to the state list through its everyday name', () => {
  assert.equal(findHospital(SAMPLE).id, 'medstar');
  assert.equal(findHospital('JOHNS HOPKINS BAYVIEW MEDICAL CENTER statement').id, 'johns-hopkins');
  assert.equal(findHospital('Sinai Hospital of Baltimore').id, 'lifebridge');
  assert.equal(findHopsitalOrNull('University of Maryland Shore Medical Center at Easton'), 'umms');
  assert.equal(findHospital('Anne Arundel Medical Center').id, 'luminis');
  assert.equal(findHospital('Peninsula Regional Medical Center').id, 'tidalhealth');
  assert.equal(findHospital('Some Clinic in Virginia'), null);
});

function findHopsitalOrNull(text) {
  return findHospital(text)?.id ?? null;
}

test('readBill returns what it found with the text it found it in', () => {
  const read = readBill(SAMPLE);
  assert.equal(read.hospital.id, 'medstar');
  assert.match(read.billDate.source, /Statement Date: 09\/14\/2026/);
  assert.match(read.amountDue.source, /Amount Due: \$2,792\.50/);
  assert.equal(readBill('').hospital, null);
});
