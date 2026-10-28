import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck, FAILED_MESSAGE } from '../src/check.js';

const TODAY = '2026-09-26';
const fields = (overrides = {}) => ({
  householdSize: '4', income: '60,000', resident: 'yes',
  snap: false, wic: false, energyAssistance: false, schoolMeals: false,
  firstBillDate: '', firstBillDateIncomplete: false, medicalBills: '', ...overrides,
});

test('good answers give a result and plain-English view', () => {
  const outcome = runCheck(fields(), TODAY);
  assert.equal(outcome.status, 'ok');
  assert.equal(outcome.result.tier, 'free');
  assert.equal(outcome.view.headline, 'Your care should be free.');
  assert.ok(Object.isFrozen(outcome));
});

test('bad answers give field errors and no result', () => {
  const outcome = runCheck(fields({ income: '', resident: '' }), TODAY);
  assert.equal(outcome.status, 'invalid');
  assert.deepEqual(Object.keys(outcome.errors).sort(), ['income', 'resident']);
  assert.equal(outcome.result, undefined);
});

test('an unexpected error becomes a clear message instead of a stale result', () => {
  const broken = () => { throw new Error('boom'); };
  const outcome = runCheck(fields(), TODAY, { checkEligibility: broken });
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.message, FAILED_MESSAGE);
  assert.equal(outcome.cause, 'boom');
});
