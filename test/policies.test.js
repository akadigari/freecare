import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLICIES, POLICIES_READ_ON, hospitalDiscount, compareWithState } from '../src/policies.js';
import { HOSPITALS } from '../src/hospitals.js';

test('every hospital on the state list has a policy entry, read on a known date', () => {
  assert.match(POLICIES_READ_ON, /^2026-\d\d-\d\d$/);
  for (const hospital of HOSPITALS) {
    const policy = POLICIES[hospital.id];
    assert.ok(policy, `${hospital.id} has no policy entry`);
    assert.ok(policy.known === false || policy.freeUpTo >= 200, `${hospital.id}: the state floor is 200%`);
    if (policy.known === false) continue;
    if (policy.policyDate !== null) assert.match(policy.policyDate, /^\d{4}(-\d\d){0,2}$/, hospital.id);
    for (const bands of [policy.standardBands, policy.hardshipBands]) {
      let last = 0;
      for (const { maxPercent, discount } of bands) {
        assert.ok(maxPercent > last, `${hospital.id}: bands must climb`);
        assert.ok(discount > 0 && discount < 100, hospital.id);
        last = maxPercent;
      }
    }
  }
  assert.doesNotMatch(JSON.stringify(POLICIES), /\u2014/);
});

test("a hospital's own discount at a given percent of the poverty line", () => {
  assert.equal(hospitalDiscount('johns-hopkins', 150, false), 100);
  assert.equal(hospitalDiscount('johns-hopkins', 350, false), 35, 'Hopkins cuts 35% up to 400% without a hardship');
  assert.equal(hospitalDiscount('johns-hopkins', 450, false), 0);
  assert.equal(hospitalDiscount('johns-hopkins', 450, true), 40);
  assert.equal(hospitalDiscount('gbmc', 280, false), 100, 'GBMC gives free care up to 300%');
  assert.equal(hospitalDiscount('gbmc', 450, false), 50);
  assert.equal(hospitalDiscount('union-hospital', 390, false), 100, 'Union gives free care up to 400%');
  assert.equal(hospitalDiscount('adventist', 550, false), null, 'Adventist gives partial help to 600% without saying how much');
  assert.equal(hospitalDiscount('adventist', 650, false), 0);
  assert.equal(hospitalDiscount('upmc-western-maryland', 150, false), undefined, 'not read');
  assert.equal(hospitalDiscount('nowhere-general', 150, false), undefined);
});

test('the better of the state rule and the hospital policy wins, and the text says which', () => {
  const state = (discount, percent, hardship = false) => ({ discount, percentOfPovertyLine: percent, hardship });
  assert.deepEqual(compareWithState('gbmc', state(60, 280)), { kind: 'better', discount: 100, policyDate: POLICIES.gbmc.policyDate });
  assert.deepEqual(compareWithState('johns-hopkins', state(0, 350)), { kind: 'better', discount: 35, policyDate: POLICIES['johns-hopkins'].policyDate });
  assert.deepEqual(compareWithState('calverthealth', state(40, 450, true)), { kind: 'same', discount: 40, policyDate: POLICIES.calverthealth.policyDate }, 'a 2019 table below the state floor never lowers the answer');
  assert.deepEqual(compareWithState('luminis', state(75, 230)), { kind: 'same', discount: 75, policyDate: POLICIES.luminis.policyDate });
  assert.deepEqual(compareWithState('adventist', state(0, 550)), { kind: 'partial', upTo: 600, policyDate: POLICIES.adventist.policyDate });
  assert.deepEqual(compareWithState('upmc-western-maryland', state(100, 150)), { kind: 'unknown' });
  assert.equal(compareWithState('', state(100, 150)), null);
});

test('every catch in a policy is a known key with a sentence in both languages', async () => {
  const { RESULT } = await import('../src/strings.js');
  const keys = new Set();
  for (const policy of Object.values(POLICIES)) for (const key of policy.catches ?? []) keys.add(key);
  assert.ok(keys.size >= 5, `only ${keys.size} kinds of catch`);
  for (const key of keys) {
    assert.ok(typeof RESULT.en.catches[key] === 'string' && RESULT.en.catches[key].length > 10, `en ${key}`);
    assert.ok(typeof RESULT.es.catches[key] === 'string' && RESULT.es.catches[key] !== RESULT.en.catches[key], `es ${key}`);
  }
  assert.deepEqual(POLICIES['johns-hopkins'].catches, ['assets100k']);
  assert.deepEqual(POLICIES['holy-cross'].catches, ['hardship20']);
  assert.deepEqual(POLICIES.calverthealth.catches, ['old2019']);
  assert.deepEqual(POLICIES['upmc-western-maryland'].catches ?? [], []);
});

test("Frederick's own 2026 matrix matches the state bands exactly and adds 20% off above 500%", () => {
  const frederick = POLICIES['frederick-health'];
  assert.equal(frederick.freeUpTo, 200);
  assert.deepEqual(frederick.standardBands.map((b) => [b.maxPercent, b.discount]), [[250, 75], [300, 60], [350, 50], [400, 45], [450, 40], [500, 35]]);
  assert.equal(frederick.partialUpTo, null);
  assert.deepEqual(frederick.catches, ['over500']);
  const stateAt280 = { discount: 60, percentOfPovertyLine: 280, hardship: false };
  assert.equal(compareWithState('frederick-health', stateAt280).kind, 'same');
});
