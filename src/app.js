import { runCheck } from './check.js';
import { PROGRAM_KEYS } from './rules.js';
import { todayIso } from './dates.js';
import { fillApplication, FORM, MAX_MEMBERS } from './apply.js';
import { PDFDocument } from '../vendor/pdf-lib/pdf-lib.esm.min.js';

const form = document.getElementById('check-form');
const button = form.querySelector('.check__button');
const formError = document.getElementById('form-error');
const resultRegion = document.getElementById('result');
const applySection = document.getElementById('apply');
const applyForm = document.getElementById('apply-form');
const applyError = document.getElementById('apply-error');
const membersBox = document.getElementById('members');
let lastResult = null;
const FIELDS_WITH_ERRORS = Object.freeze(['householdSize', 'income', 'resident', 'firstBillDate', 'medicalBills']);

function readFields(formElement) {
  const data = new FormData(formElement);
  const text = (name) => String(data.get(name) ?? '');
  return {
    householdSize: text('householdSize'),
    income: text('income'),
    resident: text('resident'),
    firstBillDate: text('firstBillDate'),
    // A half-typed date reads as empty, so ask the browser whether the box holds junk.
    firstBillDateIncomplete: formElement.elements.firstBillDate.validity.badInput,
    medicalBills: text('medicalBills'),
    ...Object.fromEntries(PROGRAM_KEYS.map((key) => [key, data.has(key)])),
  };
}

function showFieldErrors(errors) {
  for (const name of FIELDS_WITH_ERRORS) {
    const message = errors[name] ?? '';
    const slot = form.querySelector(`[data-error-for="${name}"]`);
    slot.textContent = message;
    slot.hidden = message === '';
    form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    });
  }
  const firstBad = FIELDS_WITH_ERRORS.find((name) => errors[name]);
  if (firstBad === 'firstBillDate' || firstBad === 'medicalBills') form.querySelector('details').open = true;
  if (firstBad) form.querySelector(`[name="${firstBad}"]`).focus();
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = message === '';
}

function clearResult() {
  resultRegion.replaceChildren();
  resultRegion.hidden = true;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function bulletList(items) {
  const list = element('ul');
  items.forEach((item) => list.append(element('li', item)));
  return list;
}

function sourceLine(sources) {
  const line = element('p', 'Based on ', 'verdict__sources');
  sources.forEach((source, index) => {
    const link = element('a', source.label);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    line.append(link, document.createTextNode(index < sources.length - 1 ? ', ' : '.'));
  });
  return line;
}

function renderResult(result, view) {
  const card = element('article', null, `verdict verdict--${result.tier}`);
  const headline = element('h2', view.headline, 'verdict__headline');
  headline.tabIndex = -1;
  card.append(
    headline,
    element('p', view.detail, 'verdict__detail'),
    element('p', view.deadlineText, 'verdict__deadline'),
    element('h3', 'What to bring'),
    bulletList(view.bring),
    element('h3', 'Good to know'),
    bulletList(view.notes),
    sourceLine(view.sources),
  );
  resultRegion.replaceChildren(card);
  resultRegion.hidden = false;
  headline.focus();
}

// One row per person: name, age, relationship. Row one is the applicant.
function memberRow(index) {
  const row = element('div', null, 'member');
  const make = (key, labelText, extra = {}) => {
    const wrap = element('div');
    const id = `member-${index}-${key}`;
    const label = element('label', labelText);
    label.htmlFor = id;
    const input = element('input');
    input.id = id;
    input.name = `${key}-${index}`;
    Object.assign(input, extra);
    wrap.append(label, input);
    return wrap;
  };
  row.append(
    make('name', index === 0 ? 'Your name' : `Person ${index + 1} name`),
    make('age', 'Age', { inputMode: 'numeric' }),
    make('relationship', 'Relationship to you', { value: index === 0 ? 'Self' : '', placeholder: index === 0 ? '' : 'e.g. Child' }),
  );
  return row;
}

function showApply(result) {
  lastResult = result;
  const count = Math.min(result.householdSize, MAX_MEMBERS);
  membersBox.replaceChildren(...Array.from({ length: count }, (_, i) => memberRow(i)));
  if (result.householdSize > MAX_MEMBERS) {
    membersBox.append(element('p', `The form has room for ${MAX_MEMBERS} people. List the rest on a separate sheet.`, 'hint'));
  }
  applySection.hidden = false;
}

function readMembers() {
  const data = new FormData(applyForm);
  return Array.from(membersBox.querySelectorAll('.member'), (_, i) => ({
    name: data.get(`name-${i}`),
    age: data.get(`age-${i}`),
    relationship: data.get(`relationship-${i}`),
  }));
}

function download(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = element('a');
  link.href = url;
  link.download = FORM.download;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

applyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  applyError.hidden = true;
  const data = new FormData(applyForm);
  const members = readMembers();
  const answers = {
    name: data.get('applicantName') || members[0]?.name || '',
    street: data.get('street'),
    unit: data.get('unit'),
    city: data.get('city'),
    zip: data.get('zip'),
    phone: data.get('phone'),
    members: members.map((m, i) => (i === 0 && !m.name ? { ...m, name: data.get('applicantName') } : m)),
    income: lastResult.income,
    isMarylandResident: lastResult.tier !== 'not_covered',
    medicalBillsLast12Months: lastResult.medicalBillsLast12Months,
    todayIso: todayIso(),
  };
  try {
    const response = await fetch(FORM.file);
    if (!response.ok) throw new Error(`form fetch ${response.status}`);
    const bytes = await fillApplication(new Uint8Array(await response.arrayBuffer()), answers, PDFDocument);
    download(bytes);
  } catch (error) {
    applyError.textContent = 'The form could not be filled in. Reload the page and try again, or download the blank form from the hospital.';
    applyError.hidden = false;
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const outcome = runCheck(readFields(form), todayIso());
  showFieldErrors(outcome.status === 'invalid' ? outcome.errors : {});
  showFormError(outcome.status === 'failed' ? outcome.message : '');
  if (outcome.status === 'ok') {
    renderResult(outcome.result, outcome.view);
    showApply(outcome.result);
    return;
  }
  clearResult();
  applySection.hidden = true;
});

// The button starts off in the HTML so the form can't submit without this script.
button.disabled = false;
