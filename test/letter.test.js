import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverLetter, LETTER_FILE } from '../src/letter.js';
import { checkEligibility } from '../src/rules.js';

const result = checkEligibility({ householdSize: 4, income: 60000, isMarylandResident: true, programs: {}, firstBillDate: '2026-09-01', medicalBillsLast12Months: null }, '2026-11-02');
const who = { name: 'Dana Example', street: '12 Elm St', unit: 'Apt 3', city: 'Silver Spring', zip: '20910', phone: '240-555-1234' };

test('the letter cites the law, the 14-day clock and the deadline, and signs with the patient, never this page', () => {
  const text = coverLetter({ who, hospitalName: 'Holy Cross Health (Silver Spring, Germantown)', result, todayIso: '2026-11-02', lang: 'en' });
  assert.match(text, /^November 2, 2026/);
  assert.match(text, /financial assistance office at Holy Cross Health,/, 'the campus list in parentheses stays off the letter');
  assert.match(text, /Health-General § 19-214\.1/);
  assert.match(text, /household of 4/);
  assert.match(text, /\$60,000/);
  assert.match(text, /181\.9%/);
  assert.match(text, /care should be free/);
  assert.match(text, /first bill on September 1, 2026/);
  assert.match(text, /240 days/);
  assert.match(text, /14 days/);
  assert.match(text, /pause/);
  assert.match(text, /Dana Example\n12 Elm St, Apt 3\nSilver Spring, MD 20910\n240-555-1234$/);
  assert.doesNotMatch(text, /undefined|null|freecare|\u2014/);
});

test('without a hospital, a bill date or an address, the letter leaves those lines out instead of printing blanks', () => {
  const text = coverLetter({ who: { name: 'Dana Example' }, hospitalName: '', result: { ...result, deadline: null }, todayIso: '2026-11-02', lang: 'en' });
  assert.match(text, /To the financial assistance office,/);
  assert.doesNotMatch(text, /first bill on/);
  assert.ok(text.endsWith('Thank you,\n\nDana Example'), 'the signature block is just the name');
});

test('a reduced-cost result says the cut, and the Spanish letter says the same things', () => {
  const cut = checkEligibility({ householdSize: 4, income: 70000, isMarylandResident: true, programs: {}, firstBillDate: null, medicalBillsLast12Months: null }, '2026-11-02');
  assert.match(coverLetter({ who, hospitalName: 'x', result: cut, todayIso: '2026-11-02', lang: 'en' }), /cut by 75%/);
  const es = coverLetter({ who, hospitalName: 'Holy Cross Health', result, todayIso: '2026-11-02', lang: 'es' });
  assert.match(es, /^2 de noviembre de 2026/);
  assert.match(es, /19-214\.1/);
  assert.match(es, /14 días/);
  assert.match(es, /240 días/);
  assert.doesNotMatch(es, /\u2014/);
  assert.equal(LETTER_FILE, 'freecare-cover-letter.txt');
});
