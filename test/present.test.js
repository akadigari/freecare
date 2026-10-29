import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe as describeResult, formatPercent } from '../src/present.js';
import { checkEligibility } from '../src/rules.js';

const TODAY = '2026-09-26';
const view = (overrides = {}) => describeResult(checkEligibility({
  householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
  firstBillDate: null, medicalBillsLast12Months: null, ...overrides,
}, TODAY));

test('headline for each outcome', () => {
  assert.equal(view().headline, 'Your care should be free.');
  assert.equal(view({ income: 70000 }).headline, 'Your bill should be cut by 75%.');
  assert.equal(view({ income: 200000 }).headline, "Maryland law doesn't require a discount at your income. Ask anyway.");
  assert.equal(view({ isMarylandResident: false }).headline, "Maryland's rule is for Maryland residents. Check the hospital's own policy.");
});

test('percent never looks lower than the tier it lands in', () => {
  assert.equal(formatPercent(200), '200%');
  assert.equal(formatPercent(200.003), '200.1%');
  assert.equal(formatPercent(181.818), '181.9%');
  assert.equal(formatPercent(0), '0%');
});

test('detail explains the math with the real poverty line', () => {
  assert.equal(view().detail,
    'Your household income of $60,000 is 181.9% of the 2026 federal poverty line ($33,000 for a household of 4). '
    + 'At or below 200%, Maryland hospitals have to give medically necessary care for free.');
  assert.match(view({ income: 70000 }).detail, /Between 200% and 300%, Maryland hospitals have to cut what you owe\./);
});

test('program detail names the programs', () => {
  assert.equal(view({ income: 200000, programs: { snap: true, wic: true } }).detail,
    'Because you get SNAP and WIC, you automatically qualify for free care, whatever your income. '
    + 'Your household income of $200,000 is 606.1% of the 2026 federal poverty line ($33,000 for a household of 4).');
});

test('non-resident results still show the income math', () => {
  assert.match(view({ isMarylandResident: false }).detail, /181\.9% of the 2026 federal poverty line/);
});

test('entered medical bills under 25% get a clear answer on hardship', () => {
  assert.match(view({ income: 110000, medicalBillsLast12Months: 10000 }).detail,
    /Your medical bills from the last 12 months are not more than 25% of your income, so the hardship discount doesn't apply\./);
  assert.doesNotMatch(view({ income: 110000, medicalBillsLast12Months: 10000 }).detail, /If your medical bills/);
});

test('hardship and near-hardship explanations', () => {
  assert.match(view({ income: 110000, medicalBillsLast12Months: 40000 }).detail, /more than 25% of your income/);
  assert.match(view({ income: 110000 }).detail, /may qualify for a hardship discount of 35% to 50%/);
  assert.match(view({ income: 200000 }).detail, /Above 500%/);
});

test('deadline text', () => {
  assert.equal(view().deadlineText, 'You have 240 days from your first bill to apply.');
  assert.equal(view({ firstBillDate: '2026-09-01' }).deadlineText,
    'You have 215 days left to apply. The deadline is April 29, 2027.');
  assert.equal(view({ firstBillDate: '2026-01-29' }).deadlineText, 'Today is the last day to apply.');
  assert.equal(view({ firstBillDate: '2026-01-28' }).deadlineText,
    "It's been more than 240 days since your first bill. Ask the hospital anyway, some still help.");
});

test('the result says what happens after a complete application goes in', () => {
  assert.equal(view().afterApply, 'Once you hand in a complete application, the hospital has 14 days to decide, and it has to pause billing and collection while it does.');
  assert.match(describeResult(checkEligibility({ householdSize: 1, income: 10000, isMarylandResident: true, programs: {}, firstBillDate: null, medicalBillsLast12Months: null }, TODAY), 'es').afterApply, /14 días/);
});

test('what to bring adds proof of programs', () => {
  assert.equal(view().bring.length, 3);
  assert.equal(view({ programs: { snap: true } }).bring.at(-1), 'Proof you get SNAP');
});

test('always cites the law and says it is not legal advice', () => {
  const result = view();
  assert.equal(result.sources.length, 3);
  assert.ok(result.notes.includes('Not legal advice.'));
  assert.ok(Object.isFrozen(result));
});

test('detail shows the income it used, so a misread is easy to spot', () => {
  assert.match(view({ income: 9500 }).detail, /Your household income of \$9,500 is /);
});

test('blank medical bills between 300% and 500% get a hopeful headline, not a firm no', () => {
  assert.equal(view({ income: 110000 }).headline, 'You may qualify for 35% to 50% off if your medical bills are high.');
  assert.equal(view({ income: 110000, medicalBillsLast12Months: 10000 }).headline,
    "Maryland law doesn't require a discount at your income. Ask anyway.");
  assert.equal(view({ income: 200000 }).headline, "Maryland law doesn't require a discount at your income. Ask anyway.");
});

test('the result says who decides and that the number is an estimate', () => {
  assert.match(view().notes[0], /^The hospital decides, not this page\./);
  assert.match(view({ income: 200000 }).notes[0], /^The hospital decides, not this page\./);
});

test('every result has a short stamp for the page to print across it', () => {
  assert.equal(view().stamp, 'FREE');
  assert.equal(view({ income: 70000 }).stamp, '75% OFF');
  assert.equal(view({ income: 95000 }).stamp, '60% OFF');
  assert.equal(view({ income: 110000, medicalBillsLast12Months: 40000 }).stamp, '50% OFF');
  assert.equal(view({ income: 200000 }).stamp, 'ASK ANYWAY');
  assert.equal(view({ isMarylandResident: false }).stamp, 'NOT COVERED');
});

test('a picked hospital adds one line, and takes the headline when it gives more', () => {
  assert.equal(view().hospitalText, null);
  const withView = (id, overrides = {}) => describeResult(checkEligibility({
    householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
    firstBillDate: null, medicalBillsLast12Months: null, ...overrides,
  }, TODAY), 'en', id);
  const withHospital = (id, overrides = {}) => withView(id, overrides).hospitalText;
  const gbmc = withView('gbmc', { income: 92000 });
  assert.equal(gbmc.headline, 'At Greater Baltimore Medical Center (GBMC), your care should be free.');
  assert.equal(gbmc.stamp, 'FREE');
  assert.equal(gbmc.hospitalText,
    "That is Greater Baltimore Medical Center (GBMC)'s own policy, dated October 2025, which goes further than the state rule. The state alone would cut your bill by 60%. It also looks at what you have in the bank, and enough savings can disqualify you.");
  const hopkins = withView('johns-hopkins', { income: 115000 });
  assert.equal(hopkins.headline, 'At Johns Hopkins Medicine (Hopkins Hospital, Bayview, Howard County, Suburban), your bill should be cut by 35%.');
  assert.equal(hopkins.stamp, '35% OFF');
  assert.equal(hopkins.hospitalText,
    "That is Johns Hopkins Medicine (Hopkins Hospital, Bayview, Howard County, Suburban)'s own policy, dated 2026, which goes further than the state rule. The state alone would not require a discount. It also looks at what you have in the bank: more than $100,000 in cash or investments can disqualify you.");
  assert.equal(withView('luminis').headline, 'Your care should be free.', 'the state headline stays when the hospital matches it');
  assert.equal(withHospital('luminis'), 'Luminis Health (Anne Arundel Medical Center, Doctors Community)\'s own policy, dated July 2024, matches the state rule at your income.');
  assert.equal(withHospital('sheppard-pratt'), "Sheppard Pratt's own policy matches the state rule at your income.");
  assert.equal(withHospital('adventist', { income: 180000 }),
    "Adventist HealthCare's own policy, dated April 30, 2025, promises some help up to 600% of the poverty line but does not say how much. Ask.");
  assert.match(withHospital('upmc-western-maryland'), /^The state's copy of UPMC Western Maryland's policy has no income rules in it\./);
  assert.equal(withHospital('nowhere-general'), null);
});

test('the same result reads in Spanish', () => {
  const es = (overrides = {}) => describeResult(checkEligibility({
    householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
    firstBillDate: null, medicalBillsLast12Months: null, ...overrides,
  }, TODAY), 'es');
  assert.equal(es().headline, 'Su atención debería ser gratis.');
  assert.equal(es().stamp, 'GRATIS');
  assert.equal(es().detail,
    'Los ingresos de su hogar, $60,000, son el 181.9% del nivel federal de pobreza de 2026 ($33,000 para un hogar de 4). '
    + 'Hasta el 200%, los hospitales de Maryland tienen que dar gratis la atención médicamente necesaria.');
  assert.equal(es({ income: 70000 }).headline, 'Su factura debería bajar un 75%.');
  assert.equal(es({ income: 70000 }).stamp, '75% MENOS');
  assert.equal(es({ isMarylandResident: false }).stamp, 'NO CUBIERTO');
  assert.equal(es().deadlineText, 'Tiene 240 días desde su primera factura para solicitar.');
  assert.match(es({ firstBillDate: '2026-09-01' }).deadlineText, /^Le quedan \d+ días para solicitar\. La fecha límite es el \d+ de \w+ de 2027\.$/);
  assert.equal(es({ programs: { snap: true, wic: true } }).bring.at(-1), 'Comprobante de que recibe SNAP y WIC');
  assert.match(es().notes[0], /^El hospital decide, no esta página\./);
  assert.equal(es().sources[2].label, 'Pautas federales de pobreza 2026 (HHS)');
  const gbmcEs = describeResult(checkEligibility({ householdSize: 4, income: 92000, isMarylandResident: true, programs: {}, firstBillDate: null, medicalBillsLast12Months: null }, TODAY), 'es', 'gbmc');
  assert.equal(gbmcEs.headline, 'En Greater Baltimore Medical Center (GBMC), su atención debería ser gratis.');
  assert.equal(gbmcEs.stamp, 'GRATIS');
  assert.equal(gbmcEs.hospitalText,
    'Esa es la política propia de Greater Baltimore Medical Center (GBMC), con fecha octubre de 2025, que va más allá de la regla del estado. El estado por sí solo bajaría su factura un 60%. También mira lo que tiene en el banco, y suficientes ahorros pueden descalificarlo.');
  assert.equal(es().sources[0].url, view().sources[0].url);
});

test("a hospital's catches follow its line, in plain words", () => {
  const hopkins = describeResult(checkEligibility({
    householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
    firstBillDate: null, medicalBillsLast12Months: null,
  }, TODAY), 'en', 'johns-hopkins');
  assert.match(hopkins.hospitalText, /\$100,000/);
  assert.match(hopkins.hospitalText, /matches the state rule at your income\. It also looks at what you have in the bank/);
  const garrett = describeResult(checkEligibility({
    householdSize: 4, income: 60000, isMarylandResident: true, programs: {},
    firstBillDate: null, medicalBillsLast12Months: null,
  }, TODAY), 'es', 'garrett-regional');
  assert.match(garrett.hospitalText, /\$10,000/);
});
