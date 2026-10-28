import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAY_PERIODS, yearlyIncome } from '../src/income.js';

test('pay periods are the five people actually get paid by', () => {
  assert.deepEqual([...PAY_PERIODS], ['hour', 'week', 'twoWeeks', 'month', 'year']);
});

test('pay is turned into a yearly figure', () => {
  assert.equal(yearlyIncome({ amount: '18', period: 'hour', hoursPerWeek: '30' }), 28080);
  assert.equal(yearlyIncome({ amount: '650', period: 'week' }), 33800);
  assert.equal(yearlyIncome({ amount: '1,300.50', period: 'twoWeeks' }), 33813);
  assert.equal(yearlyIncome({ amount: '$2,800', period: 'month' }), 33600);
  assert.equal(yearlyIncome({ amount: '45000', period: 'year' }), 45000);
});

test('hourly pay needs the hours, and junk gives nothing', () => {
  assert.equal(yearlyIncome({ amount: '18', period: 'hour' }), null);
  assert.equal(yearlyIncome({ amount: '18', period: 'hour', hoursPerWeek: '0' }), null);
  assert.equal(yearlyIncome({ amount: '18', period: 'hour', hoursPerWeek: '200' }), null, 'more hours than a week has');
  assert.equal(yearlyIncome({ amount: '', period: 'week' }), null);
  assert.equal(yearlyIncome({ amount: 'lots', period: 'week' }), null);
  assert.equal(yearlyIncome({ amount: '-5', period: 'week' }), null);
  assert.equal(yearlyIncome({ amount: '500', period: 'fortnight' }), null);
});
