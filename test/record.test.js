import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counselorRecord, RECORD_FILE } from '../src/record.js';
import { monthTest } from '../src/workrule.js';

const jobs = [{ employer: 'Blue Crab Diner LLC', grossCents: 128650, hours: 80, payDate: '2027-01-09', periodStart: '2026-12-22', periodEnd: '2027-01-04' }];
const model = {
  who: { name: 'Dana Example', caseNumber: 'MHC-123' },
  month: '2027-01',
  jobs,
  otherHours: { school: 0, training: 0, volunteer: 0 },
  halfTimeSchool: false,
  exemptions: ['childUnder14'],
  attachments: [{ label: 'Pay stub Jan 9', kind: 'jpeg' }],
  test: monthTest({ month: '2027-01', jobs }),
  workStatement: null,
};

test('the record says when, which rules, what was entered, what the page said, and who decides', () => {
  const text = counselorRecord({ model, nowIso: '2027-01-12T15:04:00-05:00', lang: 'en' });
  assert.match(text, /January 12, 2027/);
  assert.match(text, /Rules last checked 2026-11-\d\d/);
  assert.match(text, /marylandhealthconnection\.gov/);
  assert.match(text, /January 2027/);
  assert.match(text, /Blue Crab Diner LLC: \$1,286\.50 gross, 80 hours, paid January 9, 2027 for December 22, 2026 to January 4, 2027/);
  assert.match(text, /Meets: at least \$580 from a job \(\$1,286\.50\)/);
  assert.match(text, /child under age 14/);
  assert.match(text, /Pay stub Jan 9 \(jpeg\)/);
  assert.match(text, /This is my own summary\. Maryland Health Connection makes the decision\./);
  assert.match(text, /nothing was sent anywhere/);
  assert.doesNotMatch(text, /undefined|null|NaN|\u2014/);
  assert.equal(RECORD_FILE, 'medicaid-proof-record.txt');
});

test('nothing met prints the below-threshold line and leaves empty sections out; Spanish says the same things', () => {
  const none = { ...model, jobs: [], exemptions: [], attachments: [], test: monthTest({ month: '2027-01', jobs: [], otherHours: { volunteer: 10 } }), otherHours: { school: 0, training: 0, volunteer: 10 } };
  const text = counselorRecord({ model: none, nowIso: '2027-01-12T15:04:00-05:00', lang: 'en' });
  assert.match(text, /Below each threshold for this month/);
  assert.match(text, /10 hours/);
  assert.doesNotMatch(text, /Attachments/);
  const es = counselorRecord({ model, nowIso: '2027-01-12T15:04:00-05:00', lang: 'es' });
  assert.match(es, /12 de enero de 2027/);
  assert.match(es, /Maryland Health Connection/);
  assert.doesNotMatch(es, /\u2014/);
});

test('a month that is not YYYY-MM is printed as typed instead of crashing', () => {
  const text = counselorRecord({ model: { ...model, month: 'October 2026' }, nowIso: '2027-01-12T15:04:00-05:00', lang: 'en' });
  assert.match(text, /Month: October 2026/);
});
