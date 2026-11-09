import { runCheck } from './check.js';
import { PROGRAM_KEYS, owedAfterDiscount } from './rules.js';
import { todayIso } from './dates.js';
import { describe } from './present.js';
import { fillApplication, FORM, MAX_MEMBERS } from './apply.js';
import { applyLanguage, pickLanguage, textFor, translateError } from './i18n.js';
import { UI } from './strings.js';
import { HOSPITALS, hospitalById } from './hospitals.js';
import { deadlineCalendar, CALENDAR_FILE } from './calendar.js';
import { readBillImage } from './ocr.js';
import { readBill } from './bill.js';
import { shareText } from './share.js';
import { coverLetter, LETTER_FILE } from './letter.js';
import { yearlyIncome } from './income.js';
import { rightsFor } from './rights.js';

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
const billPhoto = document.getElementById('billPhoto');
const photoStatus = document.getElementById('photo-status');
const photoFindings = document.getElementById('photo-findings');
const payAmount = document.getElementById('payAmount');
const payPeriod = document.getElementById('payPeriod');
const payHours = document.getElementById('payHours');
const payHoursField = document.getElementById('pay-hours-field');
const payOut = document.getElementById('pay-out');
const payYearly = document.getElementById('pay-yearly');
const payUse = document.getElementById('pay-use');
const rightsSection = document.getElementById('rights');
const billSection = document.getElementById('bill');
const billName = document.getElementById('bill-name');
const billDue = document.getElementById('bill-due');
const billLaw = document.getElementById('bill-law');
const billNote = document.getElementById('bill-note');
const billAmountInput = document.getElementById('billAmount');
const EXAMPLE_BILL_CENTS = 115000;
const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FIELDS_WITH_ERRORS = Object.freeze(['householdSize', 'income', 'resident', 'firstBillDate', 'medicalBills']);
const LANG_KEY = 'freecare-lang';

let lastResult = null;
let lastView = null;
let lang = 'en';
let payFigure = null;

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
    element('p', `${view.deadlineText} ${view.afterApply}`, 'verdict__deadline'),
    ...(view.hospitalText ? [element('h3', UI[lang].yourHospital), element('p', view.hospitalText, 'verdict__hospital')] : []),
    element('h3', UI[lang].whatToBring),
    bulletList(view.bring),
    element('h3', UI[lang].goodToKnow),
    element('p', view.notes.join(' '), 'verdict__notes'),
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
  const share = element('button', UI[lang].shareResult);
  share.type = 'button';
  share.addEventListener('click', async () => {
    const text = shareText(lastView, lang);
    try {
      if (navigator.share) await navigator.share({ title: document.title, text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); share.textContent = UI[lang].copied; }
    } catch {
      // The person closed the share sheet. Nothing to do.
    }
  });
  actions.append(share);
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

// Pay helper: hourly, weekly or monthly pay becomes the yearly figure the income box wants.
function updatePay() {
  payHoursField.hidden = payPeriod.value !== 'hour';
  payFigure = yearlyIncome({ amount: payAmount.value, period: payPeriod.value, hoursPerWeek: payHours.value });
  payOut.hidden = payFigure === null;
  if (payFigure !== null) payYearly.textContent = UI[lang].payYearly(wholeDollars.format(payFigure));
}

function usePay() {
  if (payFigure === null) return;
  form.elements.income.value = String(payFigure);
  form.elements.income.focus();
}

[payAmount, payPeriod, payHours].forEach((node) => node.addEventListener('input', updatePay));
payUse.addEventListener('click', usePay);
// Enter inside the helper fills the income box instead of submitting a half-filled form.
[payAmount, payHours].forEach((node) => node.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  usePay();
}));
updatePay();

// The statement block at the top: an example until there is a result, then the person's own bill.
function billCents() {
  const cleaned = billAmountInput.value.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d+$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function renderBill() {
  const T = UI[lang];
  const cents = new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD' });
  const hospital = hospitalById(hospitalSelect.value);
  billName.textContent = hospital ? hospital.name : textFor(lang, 'bill.heading');
  if (!lastView) {
    billSection.classList.add('bill--example');
    billDue.textContent = cents.format(EXAMPLE_BILL_CENTS / 100);
    billDue.classList.add('is-struck');
    billLaw.textContent = cents.format(0);
    billNote.textContent = textFor(lang, 'bill.example');
    return;
  }
  billSection.classList.remove('bill--example');
  const discount = lastView.discount;
  const entered = billCents();
  if (entered === null) {
    billDue.textContent = T.billNotEntered;
    billDue.classList.remove('is-struck');
    billLaw.textContent = discount === 100 ? T.billFree : discount > 0 ? T.billLess(discount) : T.billFull;
    billNote.textContent = `${T.billResultNote(discount)} ${T.billTypeIt}`;
    return;
  }
  billDue.textContent = cents.format(entered / 100);
  billDue.classList.toggle('is-struck', discount > 0);
  billLaw.textContent = cents.format(owedAfterDiscount(entered, discount) / 100);
  billNote.textContent = T.billResultNote(discount);
}

billAmountInput.addEventListener('input', renderBill);

function outsideLink(text, url) {
  const link = element('a', text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function renderRights() {
  const R = rightsFor(lang);
  const help = element('ul', null, 'rights__help');
  R.help.forEach((link) => {
    const item = element('li');
    item.append(outsideLink(link.label, link.url));
    help.append(item);
  });
  const source = element('p', null, 'rights__source');
  source.append(document.createTextNode(R.source.before), outsideLink(R.source.label, R.source.url), document.createTextNode(R.source.after));
  const groups = R.groups.flatMap((g) => [element('h3', g.heading), element('p', g.text)]);
  rightsSection.replaceChildren(element('h2', R.title), element('p', R.intro), ...groups, element('p', R.helpIntro), help, source);
}

function setLanguage(next) {
  lang = next;
  applyLanguage(document, lang);
  document.title = textFor(lang, 'title');
  rememberLanguage(lang);
  renderHospitalHelp();
  renderRights();
  updatePay();
  if (lastResult) {
    lastView = describe(lastResult, lang, hospitalSelect.value);
    renderResult(lastResult, lastView, { focus: false });
    relabelMembers();
  }
  renderBill();
}

langToggle.addEventListener('click', () => setLanguage(lang === 'en' ? 'es' : 'en'));
hospitalSelect.addEventListener('change', () => {
  renderHospitalHelp();
  if (lastResult) {
    lastView = describe(lastResult, lang, hospitalSelect.value);
    renderResult(lastResult, lastView, { focus: false });
  }
  renderBill();
});
fillHospitalList();

function setPhotoStatus(text) {
  photoStatus.textContent = text;
  photoStatus.hidden = text === '';
}

// Each thing the reader found gets its own "Use this" button, so nothing fills in unconfirmed.
function finding(label, snippet, apply) {
  const item = element('li');
  const use = element('button', UI[lang].useThis);
  use.type = 'button';
  use.addEventListener('click', () => {
    apply();
    use.textContent = UI[lang].used;
    use.disabled = true;
  });
  item.append(element('span', label), use, element('small', snippet));
  return item;
}

function showFindings(read) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const T = UI[lang];
  const items = [];
  if (read.hospital) {
    items.push(finding(T.foundHospital(read.hospital.name), '', () => {
      hospitalSelect.value = read.hospital.id;
      renderHospitalHelp();
    }));
  }
  if (read.billDate) {
    items.push(finding(T.foundDate(read.billDate.iso), read.billDate.source, () => {
      form.elements.firstBillDate.value = read.billDate.iso;
    }));
  }
  if (read.amountDue) {
    items.push(finding(T.foundAmount(money.format(read.amountDue.cents / 100)), read.amountDue.source, () => {
      billAmountInput.value = (read.amountDue.cents / 100).toFixed(2);
      renderBill();
    }));
  }
  photoFindings.replaceChildren(...items);
  photoFindings.hidden = items.length === 0;
  setPhotoStatus(items.length === 0 ? T.photoNothing : '');
}

billPhoto.addEventListener('change', async () => {
  const file = billPhoto.files?.[0];
  if (!file) return;
  photoFindings.hidden = true;
  setPhotoStatus(UI[lang].photoLoading);
  try {
    const text = await readBillImage(file, { onProgress: (p) => setPhotoStatus(UI[lang].photoReading(Math.round(p * 100))) });
    showFindings(readBill(text));
  } catch {
    setPhotoStatus(UI[lang].photoFailed);
  }
});

// A printable cover letter from what the application form holds and the result above.
function openText(text, filename, title) {
  const popup = window.open('', '_blank');
  if (popup && popup.document) {
    const pre = popup.document.createElement('pre');
    pre.textContent = text;
    pre.style.cssText = 'font: 12pt/1.6 Helvetica, Arial, sans-serif; white-space: pre-wrap; max-width: 40rem; margin: 2rem auto;';
    popup.document.title = title;
    popup.document.body.append(pre);
    popup.document.close();
    return;
  }
  downloadText(text, filename, 'text/plain');
}

document.getElementById('letter-button').addEventListener('click', () => {
  if (!lastResult) { applyError.textContent = UI[lang].letterNeedsResult; applyError.hidden = false; return; }
  const data = new FormData(applyForm);
  const text = (name) => String(data.get(name) ?? '');
  const hospital = hospitalById(hospitalSelect.value);
  const letter = coverLetter({
    who: { name: text('applicantName'), street: text('street'), unit: text('unit'), city: text('city'), zip: text('zip'), phone: text('phone') },
    hospitalName: hospital ? hospital.name : '',
    result: lastResult,
    todayIso: todayIso(),
    lang,
  });
  openText(letter, LETTER_FILE, UI[lang].letterTitle);
});

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
  const outcome = runCheck(readFields(form), todayIso(), { describe: (result) => describe(result, lang, hospitalSelect.value) });
  showFieldErrors(outcome.status === 'invalid' ? outcome.errors : {});
  showFormError(outcome.status === 'failed' ? outcome.message : '');
  if (outcome.status === 'ok') {
    lastView = outcome.view;
    renderResult(outcome.result, outcome.view);
    showApply(outcome.result);
    renderBill();
    return;
  }
  clearResult();
  lastView = null;
  applySection.hidden = true;
  renderBill();
});

setLanguage(pickLanguage(savedLanguage(), navigator.language));

// The button starts off in the HTML so the form can't submit without this script.
button.disabled = false;

// Keeps a copy of the page on the phone, so it opens in a hospital basement with no signal.
// The renewal page (renew.html) can hand over household size and yearly income through
// sessionStorage. This page reads them once, fills the two boxes, and forgets them.
function readHandoff() {
  try {
    const raw = sessionStorage.getItem('freecare-handoff');
    if (!raw) return;
    sessionStorage.removeItem('freecare-handoff');
    const { householdSize, income } = JSON.parse(raw);
    const size = String(householdSize ?? '').trim();
    const yearly = String(income ?? '').replace(/[$,\s]/g, '');
    if (/^\d+$/.test(size) && Number(size) > 0) form.elements.householdSize.value = size;
    if (/^\d*\.?\d+$/.test(yearly) && Number(yearly) > 0) form.elements.income.value = yearly;
  } catch { /* private window, storage off, or bad JSON: start blank */ }
}
readHandoff();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
