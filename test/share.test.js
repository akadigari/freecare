import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from '../src/share.js';
import { describe } from '../src/present.js';
import { checkEligibility } from '../src/rules.js';

const result = checkEligibility({ householdSize: 4, income: 60000, isMarylandResident: true, programs: {}, firstBillDate: '2026-09-01', medicalBillsLast12Months: null }, '2026-11-02');

test('the share text is the result in plain words with the law and nothing personal beyond the numbers typed', () => {
  const text = shareText(describe(result, 'en'), 'en');
  assert.match(text, /^Your care should be free\./);
  assert.match(text, /181\.9%/);
  assert.match(text, /240 days|days left/);
  assert.match(text, /Health-General § 19-214\.1/);
  assert.match(text, /not legal advice/i);
  assert.doesNotMatch(text, /undefined|\u2014|http/);
  assert.ok(text.length < 900, `${text.length} characters is too long for a text message`);
});

test('the Spanish share text reads in Spanish', () => {
  const text = shareText(describe(result, 'es'), 'es');
  assert.match(text, /^Su atención debería ser gratis\./);
  assert.match(text, /19-214\.1/);
});
