// Fills Maryland's statewide financial assistance application from the answers
// already on the page. The PDF is the state's own form (every Maryland hospital
// uses it since December 2025). Field names below are the ones inside that PDF.
// Nothing here touches the network: the page fetches its own copy of the form.

export const FORM = Object.freeze({
  file: 'forms/md-uniform-financial-assistance-2026-03-06.pdf',
  revised: '2026-03-06',
  source: 'https://hscrc.maryland.gov/Pages/consumers_uniform.aspx',
  download: 'maryland-financial-assistance-application.pdf',
});

export const MAX_MEMBERS = 7;

// The form's rows are not named consistently, so the map is written out by hand.
const MEMBER_ROWS = Object.freeze([
  { name: 'Name of Household Member', age: 'Age of Household Member', relationship: 'Relationship' },
  { name: 'Name of Household Member1', age: 'Age of Household Member2', relationship: 'Relationship2' },
  { name: 'Name of Household Member3', age: 'Age of Household Member3', relationship: 'Relationship3' },
  { name: 'Name of Household Member4', age: 'Age of Household Member4', relationship: 'Relationship4' },
  { name: 'Name of Household Member5', age: 'Age of Household Member5', relationship: 'Relationship5' },
  { name: 'Name of Household Member6', age: 'Age of Household Member6', relationship: 'Relationship6' },
  { name: 'Name of Household Member7', age: 'Age of Household Member7', relationship: 'Relationship7' },
].map(Object.freeze));

// The yes or no questions are radio groups. In every one, the Yes box is the left one.
export const YES_NO_FIELDS = Object.freeze([
  'Primary Residence',
  'MD resident 6 months',
  'Financial Hardship',
  'Maryland Medical Assistance',
]);

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const clean = (value) => String(value ?? '').trim();

// The form has three boxes: area code, the next three digits, the last four.
export function splitPhone(text) {
  const digits = clean(text).replace(/\D/g, '');
  if (digits.length === 10) return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
  if (digits.length === 7) return ['', digits.slice(0, 3), digits.slice(3)];
  return ['', '', ''];
}

function usDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

function memberFields(members) {
  const text = {};
  MEMBER_ROWS.forEach((row, index) => {
    const member = members[index];
    text[row.name] = member ? clean(member.name) : '';
    text[row.age] = member && member.age !== '' && member.age != null ? String(member.age) : '';
    text[row.relationship] = member ? clean(member.relationship) : '';
  });
  return text;
}

// Turns page answers into the exact text and yes/no values for the PDF.
// A yes/no of null leaves the question for the patient to answer.
// The signature is always left blank: a person signs, not this page.
export function buildFieldValues(answers) {
  const [areaCode, prefix, line] = splitPhone(answers.phone);
  const members = Array.isArray(answers.members) ? answers.members : [];
  const bills = Number(answers.medicalBillsLast12Months);
  const hasHardship = Number.isFinite(bills) && bills > 0;
  const income = Number(answers.income);
  const assets = Number(answers.assets);
  // The form only asks for monetary assets above $100,000.
  const assetsText = answers.assets !== '' && answers.assets != null && Number.isFinite(assets) && assets > 100000 ? money.format(assets) : '';
  const medicaid = answers.medicaid === 'yes' || answers.medicaid === 'no' ? answers.medicaid : null;
  const text = Object.freeze({
    Name: clean(answers.name),
    'Street Address': clean(answers.street),
    Unit: clean(answers.unit),
    City: clean(answers.city),
    State: 'MD',
    'Zip Code': clean(answers.zip),
    Country: 'USA',
    'Area Code': areaCode,
    undefined: prefix,
    undefined_2: line,
    ...memberFields(members),
    fill_4: answers.income !== '' && answers.income != null && Number.isFinite(income) ? `${money.format(income)} per year` : '',
    'Medicaid date': medicaid === 'yes' && /^\d{4}-\d{2}-\d{2}$/.test(String(answers.medicaidDate ?? '')) ? usDate(answers.medicaidDate) : '',
    'Application determination': medicaid === 'yes' ? clean(answers.medicaidDetermination) : '',
    'Out of pocket expenses': hasHardship ? money.format(bills) : '',
    Assets: assetsText,
    'Applicant signature': '',
    Date: answers.todayIso ? usDate(answers.todayIso) : '',
    'Relationship to Patient': 'Self',
  });
  const choices = Object.freeze({
    'Primary Residence': answers.isMarylandResident === true ? 'yes' : null,
    'MD resident 6 months': null,
    'Financial Hardship': hasHardship ? 'yes' : null,
    'Maryland Medical Assistance': medicaid,
  });
  return Object.freeze({ text, choices, overflow: Math.max(0, members.length - MAX_MEMBERS) });
}

// The option whose box sits furthest left is Yes; furthest right is No.
export function optionFor(group, choice) {
  const widgets = group.acroField.getWidgets()
    .map((widget) => ({ value: widget.getOnValue()?.decodeText?.() ?? String(widget.getOnValue()).replace(/^\//, ''), x: widget.getRectangle().x }))
    .sort((a, b) => a.x - b.x);
  if (widgets.length === 0) return null;
  return choice === 'yes' ? widgets[0].value : widgets[widgets.length - 1].value;
}

// `PDFDocument` is passed in so the page and the tests load pdf-lib the same way.
export async function fillApplication(blankBytes, answers, PDFDocument) {
  const { text, choices } = buildFieldValues(answers);
  const doc = await PDFDocument.load(blankBytes);
  const form = doc.getForm();
  for (const [field, value] of Object.entries(text)) {
    // Blank values are never written, so the signature line stays untouched.
    if (value === '') continue;
    form.getTextField(field).setText(value);
  }
  for (const [field, choice] of Object.entries(choices)) {
    if (choice === null) continue;
    const group = form.getRadioGroup(field);
    group.select(optionFor(group, choice));
  }
  return doc.save();
}
