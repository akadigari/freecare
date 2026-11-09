import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, ACTIVITIES, EXEMPTIONS, EXEMPTION_GROUPS, PROOF_TYPES, monthOf, previousMonth, monthTest, exemptionsById, jobsOutsideMonth } from '../src/workrule.js';
import { WORKRULE, LANGS } from '../src/strings.js';

test('the thresholds are the ones on the Maryland page, with a verified date', () => {
  assert.equal(RULES.earningsFloorCents, 58000);
  assert.equal(RULES.hoursFloor, 80);
  assert.equal(RULES.starts, '2027-01-01');
  assert.match(RULES.verified, /^2026-11-\d\d$/);
  assert.match(RULES.source, /^https:\/\/www\.marylandhealthconnection\.gov\//);
  assert.deepEqual([...ACTIVITIES], ['work', 'school', 'training', 'volunteer']);
});

test('earnings at exactly $580 meet the test and a cent less does not', () => {
  const met = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 58000, hours: 40 }] });
  assert.equal(met.met, 'earnings');
  assert.deepEqual(met.shortfall, { cents: 0, hours: 40 });
  const short = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 57999, hours: 40 }] });
  assert.equal(short.met, null);
  assert.deepEqual(short.shortfall, { cents: 1, hours: 40 });
});

test('80 hours of any mix meet the test, 79.5 do not, and earnings win when both are met', () => {
  const hours = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 30000, hours: 30 }], otherHours: { school: 20, training: 10, volunteer: 20 } });
  assert.equal(hours.hoursTotal, 80);
  assert.equal(hours.met, 'hours');
  const almost = monthTest({ month: '2027-01', jobs: [], otherHours: { volunteer: 79.5 } });
  assert.equal(almost.met, null);
  assert.equal(almost.shortfall.hours, 0.5);
  const both = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 90000, hours: 90 }] });
  assert.equal(both.met, 'earnings');
  assert.deepEqual(both.metAll, ['earnings', 'hours']);
});

test('half-time school meets the test on its own and sums across jobs are gross', () => {
  const school = monthTest({ month: '2027-01', halfTimeSchool: true });
  assert.equal(school.met, 'school');
  const two = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 30000, hours: 25 }, { employer: 'B', grossCents: 28000, hours: 20 }] });
  assert.equal(two.grossCents, 58000);
  assert.equal(two.jobHours, 45);
  assert.equal(two.met, 'earnings');
});

test('bad numbers count as zero instead of breaking the arithmetic', () => {
  const r = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: -5, hours: 'x' }], otherHours: { school: NaN } });
  assert.equal(r.grossCents, 0);
  assert.equal(r.hoursTotal, 0);
  assert.equal(r.met, null);
  assert.ok(Object.isFrozen(r));
});

test('month helpers: pay date to month, and the month before today', () => {
  assert.equal(monthOf('2027-01-09'), '2027-01');
  assert.equal(monthOf('2027-13-01'), null);
  assert.equal(monthOf('nope'), null);
  assert.equal(previousMonth('2027-02-03'), '2027-01');
  assert.equal(previousMonth('2027-01-15'), '2026-12');
});

test('the exemption list is the Maryland list, grouped, each with proof hints and words in both languages', () => {
  assert.equal(EXEMPTIONS.length, 20);
  assert.deepEqual([...EXEMPTION_GROUPS], ['general', 'special', 'health', 'hardship', 'local']);
  for (const e of EXEMPTIONS) {
    assert.ok(EXEMPTION_GROUPS.includes(e.group), e.id);
    assert.ok(e.proof.length >= 1 || e.group === 'local', e.id);
    for (const p of e.proof) assert.ok(PROOF_TYPES.includes(p), `${e.id}: ${p}`);
    for (const lang of LANGS) {
      assert.ok(WORKRULE[lang].exemption[e.id], `${lang} ${e.id}`);
      assert.ok(WORKRULE[lang].group[e.group], `${lang} ${e.group}`);
    }
  }
  assert.deepEqual(exemptionsById(['childUnder14', 'nope', 'medicare']).map((e) => e.id), ['medicare', 'childUnder14']);
  assert.match(WORKRULE.en.exemption.childUnder14, /child under age 14/);
  assert.equal(WORKRULE.en.decides, 'This is my own summary. Maryland Health Connection makes the decision.');
  for (const key of Object.keys(WORKRULE.en.proof)) assert.ok(WORKRULE.es.proof[key], key);
  assert.notEqual(WORKRULE.es.belowAll, WORKRULE.en.belowAll);
});

test('hours are rounded to the hundredth, so 0.1 + 64.1 + 15.8 is 80 and meets the test', () => {
  const exact = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 0, hours: 0.1 }, { employer: 'B', grossCents: 0, hours: 64.1 }], otherHours: { volunteer: 15.8 } });
  assert.equal(exact.hoursTotal, 80);
  assert.equal(exact.met, 'hours');
  const noisy = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 0, hours: 10.1 }, { employer: 'B', grossCents: 0, hours: 20.2 }], otherHours: { school: 0.1, training: 0.2 } });
  assert.equal(noisy.jobHours, 30.3);
  assert.equal(noisy.hoursTotal, 30.6);
  assert.equal(noisy.shortfall.hours, 49.4);
});

test('jobsOutsideMonth names the jobs whose pay date falls in another month', () => {
  const jobs = [{ employer: 'A', payDate: '2027-01-09' }, { employer: 'B', payDate: '2026-12-11' }, { employer: 'C', payDate: null }];
  assert.deepEqual(jobsOutsideMonth('2027-01', jobs).map((j) => j.employer), ['B']);
  assert.deepEqual(jobsOutsideMonth('2026-12', jobs).map((j) => j.employer), ['A']);
  assert.deepEqual(jobsOutsideMonth(null, jobs), []);
});
