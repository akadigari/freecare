import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { buildFieldValues, fillApplication, optionFor, FORM, MAX_MEMBERS, splitPhone } from '../src/apply.js';

const blank = readFileSync(new URL(`../${FORM.file}`, import.meta.url));

const answers = (overrides = {}) => ({
  name: 'Dana Example',
  street: '12 Oak St',
  unit: 'Apt 3',
  city: 'Dundalk',
  zip: '21222',
  phone: '(240) 555-3866',
  members: [
    { name: 'Dana Example', age: 34, relationship: 'Self' },
    { name: 'Sam Example', age: 8, relationship: 'Child' },
  ],
  income: 60000,
  isMarylandResident: true,
  medicalBillsLast12Months: null,
  todayIso: '2026-10-27',
  ...overrides,
});

test('the form on disk is the state form, two pages, with the fields we fill', async () => {
  const doc = await PDFDocument.load(blank);
  assert.equal(doc.getPageCount(), 2);
  const names = doc.getForm().getFields().map((field) => field.getName());
  for (const name of ['Name', 'Street Address', 'City', 'Zip Code', 'fill_4', 'Financial Hardship', 'Out of pocket expenses', 'Applicant signature']) {
    assert.ok(names.includes(name), `missing field ${name}`);
  }
  assert.equal(FORM.revised, '2026-03-06');
});

test('phone numbers split into the three boxes the form has', () => {
  assert.deepEqual(splitPhone('(240) 555-3866'), ['240', '555', '3866']);
  assert.deepEqual(splitPhone('2405553866'), ['240', '555', '3866']);
  assert.deepEqual(splitPhone(''), ['', '', '']);
  assert.deepEqual(splitPhone('555-3866'), ['', '555', '3866']);
});

test('answers map onto the form fields, and nobody signs for the patient', () => {
  const { text, choices, overflow } = buildFieldValues(answers());
  assert.equal(text.Name, 'Dana Example');
  assert.equal(text['Street Address'], '12 Oak St');
  assert.equal(text.Unit, 'Apt 3');
  assert.equal(text.City, 'Dundalk');
  assert.equal(text.State, 'MD');
  assert.equal(text['Zip Code'], '21222');
  assert.equal(text.Country, 'USA');
  assert.equal(text['Area Code'], '240');
  assert.equal(text.undefined, '555');
  assert.equal(text.undefined_2, '3866');
  assert.equal(text['Name of Household Member'], 'Dana Example');
  assert.equal(text['Age of Household Member'], '34');
  assert.equal(text.Relationship, 'Self');
  assert.equal(text['Name of Household Member1'], 'Sam Example');
  assert.equal(text['Age of Household Member2'], '8');
  assert.equal(text.Relationship2, 'Child');
  assert.equal(text.fill_4, '$60,000 per year');
  assert.equal(text.Date, '10/27/2026');
  assert.equal(text['Relationship to Patient'], 'Self');
  assert.equal(text['Applicant signature'], '');
  assert.equal(text['Out of pocket expenses'], '');
  assert.equal(choices['Primary Residence'], 'yes');
  assert.equal(choices['Financial Hardship'], null);
  assert.equal(choices['Maryland Medical Assistance'], null);
  assert.equal(overflow, 0);
});

test('unpaid hospital bills turn on the hardship section', () => {
  const { text, choices } = buildFieldValues(answers({ medicalBillsLast12Months: 2500 }));
  assert.equal(choices['Financial Hardship'], 'yes');
  assert.equal(text['Out of pocket expenses'], '$2,500');
});

test('a non-resident leaves the residence question for the patient', () => {
  const { choices } = buildFieldValues(answers({ isMarylandResident: false }));
  assert.equal(choices['Primary Residence'], null);
});

test('in every yes or no group the left box is Yes', async () => {
  const form = (await PDFDocument.load(blank)).getForm();
  assert.equal(optionFor(form.getRadioGroup('Primary Residence'), 'yes'), 'Yes');
  assert.equal(optionFor(form.getRadioGroup('Primary Residence'), 'no'), 'No');
  for (const name of ['MD resident 6 months', 'Financial Hardship', 'Maryland Medical Assistance']) {
    const group = form.getRadioGroup(name);
    assert.notEqual(optionFor(group, 'yes'), optionFor(group, 'no'), name);
  }
});

test('the form has room for seven people and says how many did not fit', () => {
  const members = Array.from({ length: 9 }, (_, i) => ({ name: `Person ${i + 1}`, age: 20 + i, relationship: i === 0 ? 'Self' : 'Child' }));
  const { text, overflow } = buildFieldValues(answers({ members }));
  assert.equal(MAX_MEMBERS, 7);
  assert.equal(text['Name of Household Member7'], 'Person 7');
  assert.equal(overflow, 2);
});

test('the filled PDF reads back what was typed and stays editable', async () => {
  const bytes = await fillApplication(blank, answers({ medicalBillsLast12Months: 2500 }), PDFDocument);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  assert.equal(doc.getPageCount(), 2);
  assert.equal(form.getTextField('Name').getText(), 'Dana Example');
  assert.equal(form.getTextField('fill_4').getText(), '$60,000 per year');
  assert.equal(form.getTextField('Out of pocket expenses').getText(), '$2,500');
  assert.equal(form.getRadioGroup('Primary Residence').getSelected(), 'Yes');
  const hardship = form.getRadioGroup('Financial Hardship');
  assert.equal(hardship.getSelected(), optionFor(hardship, 'yes'));
  assert.equal(form.getRadioGroup('Maryland Medical Assistance').getSelected(), undefined);
  const signature = form.getField('Applicant signature');
  assert.equal(signature.getName(), 'Applicant signature');
  assert.ok(typeof signature.getText !== 'function' || !signature.getText(), 'nobody signs for the patient');
});
