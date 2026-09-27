import { parseForm } from './form.js';
import { checkEligibility, PROGRAM_KEYS } from './rules.js';
import { describe } from './present.js';
import { todayIso } from './dates.js';

const form = document.getElementById('check-form');
const resultRegion = document.getElementById('result');
const FIELDS_WITH_ERRORS = Object.freeze(['householdSize', 'income', 'resident', 'firstBillDate', 'medicalBills']);

function readFields(formElement) {
  const data = new FormData(formElement);
  const text = (name) => String(data.get(name) ?? '');
  return {
    householdSize: text('householdSize'),
    income: text('income'),
    resident: text('resident'),
    firstBillDate: text('firstBillDate'),
    medicalBills: text('medicalBills'),
    ...Object.fromEntries(PROGRAM_KEYS.map((key) => [key, data.has(key)])),
  };
}

function showErrors(errors) {
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const today = todayIso();
  const parsed = parseForm(readFields(form), today);
  showErrors(parsed.ok ? {} : parsed.errors);
  if (!parsed.ok) {
    resultRegion.replaceChildren();
    resultRegion.hidden = true;
    return;
  }
  const result = checkEligibility(parsed.input, today);
  renderResult(result, describe(result));
});
