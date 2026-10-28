import { runCheck } from './check.js';
import { PROGRAM_KEYS } from './rules.js';
import { todayIso } from './dates.js';
import { describe } from './present.js';
import { fillApplication, FORM, MAX_MEMBERS } from './apply.js';
import { applyLanguage, pickLanguage, textFor, translateError } from './i18n.js';
import { UI } from './strings.js';
import { HOSPITALS, hospitalById } from './hospitals.js';
import { deadlineCalendar, CALENDAR_FILE } from './calendar.js';

const form = document.getElementById('check-form');
const button = form.querySelector('.check__button');
const formError = document.getElementById('form-error');
const resultRegion = document.getElementById('result');
const applySection = document.getElementById('apply');
const applyForm = document.getElementById('apply-form');
const applyError = document.getElementById('apply-error');
const membersBox = document.getElementById('members');
const langToggle = document.getElementById('lang-toggle');
const hospitalSelect = document.getElementById('hospital');
const hospitalHelp = document.getElementById('hospital-help');
const FIELDS_WITH_ERRORS = Object.freeze(['householdSize', 'income', 'resident', 'firstBillDate', 'medicalBills']);
const LANG_KEY = 'freecare-lang';

let lastResult = null;
let lang = 'en';

// Browser storage is a convenience only; the page works without it.
function savedLanguage() {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}

function rememberLanguage(next) {
  try { localStorage.setItem(LANG_KEY, next); } catch { /* private window or storage off */ }
}

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
    slot.textContent = translateError(message, lang);
    slot.hidden = message === '';
    for (const input of form.querySelectorAll(`[name="${name}"]`)) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }
  const firstBad = FIELDS_WITH_ERRORS.find((name) => errors[name]);
  if (firstBad) form.querySelector(`[name="${firstBad}"]`).focus();
}

function showFormError(message) {
  formError.textContent = translateError(message, lang);
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
  const line = element('p', UI[lang].basedOn, 'verdict__sources');
  sources.forEach((source, index) => {
    const link = element('a', source.label);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    line.append(link, document.createTextNode(index < sources.length - 1 ? ', ' : '.'));
  });
  return line;
}

function renderResult(result, view, { focus = true } = {}) {
  const card = element('article', null, `verdict verdict--${result.tier}`);
  const headline = element('h2', view.headline, 'verdict__headline');
  headline.tabIndex = -1;
  // The stamp repeats the headline for the eye, so screen readers skip it.
  const stamp = element('p', view.stamp, 'verdict__stamp');
  stamp.ariaHidden = 'true';
  card.append(
    stamp,
    headline,
    element('p', view.detail, 'verdict__detail'),
    element('p', view.deadlineText, 'verdict__deadline'),
    element('h3', UI[lang].whatToBring),
    bulletList(view.bring),
    element('h3', UI[lang].goodToKnow),
    bulletList(view.notes),
    sourceLine(view.sources),
    resultActions(result),
  );
  resultRegion.replaceChildren(card);
  resultRegion.hidden = false;
  if (focus) headline.focus();
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Print the result, and when there is a real deadline, save it as a calendar reminder.
function resultActions(result) {
  const actions = element('div', null, 'verdict__actions');
  const print = element('button', UI[lang].printResult);
  print.type = 'button';
  print.addEventListener('click', () => window.print());
  actions.append(print);
  if (result.deadline?.isOpen) {
    const save = element('button', UI[lang].addToCalendar);
    save.type = 'button';
    save.addEventListener('click', () => downloadText(deadlineCalendar(result.deadline.deadline, lang), CALENDAR_FILE, 'text/calendar'));
    actions.append(save);
  }
  return actions;
}

// One row per person: name, age, relationship. Row one is the applicant.
function memberRow(index) {
  const row = element('div', null, 'member');
  const make = (key, labelText, extra = {}) => {
    const wrap = element('div');
    const id = `member-${index}-${key}`;
    const label = element('label', labelText);
    label.htmlFor = id;
    label.dataset.memberLabel = key;
    const input = element('input');
    input.id = id;
    input.name = `${key}-${index}`;
    Object.assign(input, extra);
    wrap.append(label, input);
    return wrap;
  };
  const T = UI[lang];
  row.append(
    make('name', index === 0 ? T.yourName : T.personName(index + 1)),
    make('age', T.age, { inputMode: 'numeric' }),
    make('relationship', T.relationship, { value: index === 0 ? T.self : '', placeholder: index === 0 ? '' : T.relationshipExample }),
  );
  return row;
}

// Switching language must not throw away names already typed, so rows are relabeled in place.
function relabelMembers() {
  const T = UI[lang];
  membersBox.querySelectorAll('.member').forEach((row, index) => {
    row.querySelector('[data-member-label="name"]').textContent = index === 0 ? T.yourName : T.personName(index + 1);
    row.querySelector('[data-member-label="age"]').textContent = T.age;
    row.querySelector('[data-member-label="relationship"]').textContent = T.relationship;
  });
  const note = membersBox.querySelector('.hint');
  if (note) note.textContent = T.overflow(MAX_MEMBERS);
}

function showApply(result) {
  lastResult = result;
  const count = Math.min(result.householdSize, MAX_MEMBERS);
  membersBox.replaceChildren(...Array.from({ length: count }, (_, i) => memberRow(i)));
  if (result.householdSize > MAX_MEMBERS) membersBox.append(element('p', UI[lang].overflow(MAX_MEMBERS), 'hint'));
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

// The hospital list is the state's. Picking one shows a link to that hospital's own policy.
function fillHospitalList() {
  for (const hospital of HOSPITALS) {
    const option = element('option', hospital.name);
    option.value = hospital.id;
    hospitalSelect.append(option);
  }
}

function renderHospitalHelp() {
  const T = UI[lang];
  const hospital = hospitalById(hospitalSelect.value);
  hospitalHelp.replaceChildren();
  if (!hospital) {
    hospitalHelp.textContent = T.hospitalHint;
    return;
  }
  const link = element('a', T.hospitalPolicyLink(hospital.name, T.policyKinds[hospital.policyKind]));
  link.href = hospital.policyUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  hospitalHelp.append(link, document.createTextNode(T.hospitalPolicyRest(hospital.fileType)));
}

function setLanguage(next) {
  lang = next;
  applyLanguage(document, lang);
  document.title = textFor(lang, 'title');
  rememberLanguage(lang);
  renderHospitalHelp();
  if (lastResult) {
    renderResult(lastResult, describe(lastResult, lang), { focus: false });
    relabelMembers();
  }
}

langToggle.addEventListener('click', () => setLanguage(lang === 'en' ? 'es' : 'en'));
hospitalSelect.addEventListener('change', renderHospitalHelp);
fillHospitalList();

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
    medicaid: data.get('medicaid'),
    medicaidDate: data.get('medicaidDate'),
    medicaidDetermination: data.get('medicaidDetermination'),
    assets: String(data.get('assets') ?? '').replace(/[\s$,]/g, ''),
    todayIso: todayIso(),
  };
  try {
    // The PDF library is half a megabyte, so it loads only when someone gets this far.
    const [{ PDFDocument }, response] = await Promise.all([import('../vendor/pdf-lib/pdf-lib.esm.min.js'), fetch(FORM.file)]);
    if (!response.ok) throw new Error(`form fetch ${response.status}`);
    const bytes = await fillApplication(new Uint8Array(await response.arrayBuffer()), answers, PDFDocument);
    download(bytes);
  } catch {
    applyError.textContent = UI[lang].applyFailed;
    applyError.hidden = false;
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const outcome = runCheck(readFields(form), todayIso(), { describe: (result) => describe(result, lang) });
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

setLanguage(pickLanguage(savedLanguage(), navigator.language));

// The button starts off in the HTML so the form can't submit without this script.
button.disabled = false;
