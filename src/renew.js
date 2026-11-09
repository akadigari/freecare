// The proof-packet page. Wires the pure modules (workrule, stub, packet, record) to the form,
// the way app.js wires the bill page. Nothing here touches the network: the reader, the PDF
// library and the fonts are the page's own files, and nothing is kept after the tab closes.

import { RULES, EXEMPTIONS, EXEMPTION_GROUPS, monthTest, previousMonth, monthOf, jobsOutsideMonth } from './workrule.js';
import { readStub } from './stub.js';
import { readBillImage } from './ocr.js';
import { buildPacket, PACKET_FILE, MAX_IMAGE_EDGE } from './packet.js';
import { counselorRecord, RECORD_FILE } from './record.js';
import { applyLanguage, pickLanguage, textFor } from './i18n.js';
import { UI, WORKRULE } from './strings.js';
import { todayIso } from './dates.js';

const form = document.getElementById('renew-form');
const jobsBox = document.getElementById('jobs');
const addJobButton = document.getElementById('add-job');
const monthInput = document.getElementById('month');
const memberName = document.getElementById('memberName');
const caseNumber = document.getElementById('caseNumber');
const stubPhoto = document.getElementById('stubPhoto');
const stubStatus = document.getElementById('stub-status');
const stubFindings = document.getElementById('stub-findings');
const schoolHours = document.getElementById('schoolHours');
const trainingHours = document.getElementById('trainingHours');
const volunteerHours = document.getElementById('volunteerHours');
const halfTime = document.getElementById('halfTimeSchool');
const exemptionGroups = document.getElementById('exemption-groups');
const attachmentFiles = document.getElementById('attachmentFiles');
const attachmentsList = document.getElementById('attachments');
const wsEmployer = document.getElementById('wsEmployer');
const wsContact = document.getElementById('wsContact');
const wsDates = document.getElementById('wsDates');
const wsHours = document.getElementById('wsHours');
const wsPay = document.getElementById('wsPay');
const summaryEarned = document.getElementById('summary-earned');
const summaryHours = document.getElementById('summary-hours');
const summaryMeets = document.getElementById('summary-meets');
const summaryWarning = document.getElementById('summary-warning');
const errorBox = document.getElementById('renew-error');
const buildButton = document.getElementById('build-button');
const recordButton = document.getElementById('record-button');
const startOverButton = document.getElementById('start-over');
const householdSize = document.getElementById('householdSize');
const incomeInput = document.getElementById('income');
const toBill = document.getElementById('to-bill');
const langToggle = document.getElementById('lang-toggle');

const LANG_KEY = 'freecare-lang';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

let lang = 'en';
let attachments = []; // [{ id, name, label, kind, bytes }]
let nextId = 1;
let incomeTouched = false;
let monthTouched = false;

// Browser storage is a convenience only; the page works without it.
function savedLanguage() {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}
function rememberLanguage(next) {
  try { localStorage.setItem(LANG_KEY, next); } catch { /* private window or storage off */ }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// "$1,286.50" reads as 128650 cents; "80" reads as 80. Anything else reads as zero.
function toCents(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  return /^\d*\.?\d+$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : 0;
}
function toNumber(text) {
  const cleaned = String(text ?? '').replace(/[,\s]/g, '');
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : 0;
}

// Job rows. One per job; the "Use this" buttons from a pay stub fill the first empty row.
const JOB_FIELDS = Object.freeze([
  ['employer', 'jobEmployer', 'text'], ['gross', 'jobGross', 'decimal'], ['hours', 'jobHours', 'decimal'],
  ['payDate', 'jobPayDate', 'date'], ['periodStart', 'jobPeriodStart', 'date'], ['periodEnd', 'jobPeriodEnd', 'date'],
]);

function addJobRow() {
  const row = element('div', '', 'job');
  for (const [key, uiKey, kind] of JOB_FIELDS) {
    const label = element('label');
    const span = element('span', UI[lang][uiKey]);
    span.dataset.ui = uiKey;
    const input = element('input');
    input.className = `job__${key}`;
    if (kind === 'date') input.type = 'date';
    else {
      input.type = 'text';
      input.autocomplete = 'off';
      if (kind === 'decimal') input.inputMode = 'decimal';
    }
    input.addEventListener('input', renderSummary);
    label.append(span, input);
    row.append(label);
  }
  const remove = element('button', UI[lang].removeJob, 'check__button check__button--quiet job__remove');
  remove.type = 'button';
  remove.dataset.ui = 'removeJob';
  remove.addEventListener('click', () => {
    if (jobsBox.children.length > 1) { row.remove(); renderSummary(); }
  });
  row.append(remove);
  jobsBox.append(row);
  return row;
}

function relabelJobs() {
  for (const node of jobsBox.querySelectorAll('[data-ui]')) node.textContent = UI[lang][node.dataset.ui];
}

function readJobs() {
  const value = (row, key) => row.querySelector(`.job__${key}`).value;
  return [...jobsBox.querySelectorAll('.job')]
    .map((row) => ({
      employer: value(row, 'employer').trim(),
      grossCents: toCents(value(row, 'gross')),
      hours: toNumber(value(row, 'hours')),
      payDate: value(row, 'payDate') || null,
      periodStart: value(row, 'periodStart') || null,
      periodEnd: value(row, 'periodEnd') || null,
    }))
    .filter((job) => job.employer || job.grossCents || job.hours);
}

// The exemption list comes from workrule.js, so the page has no exemption text to keep in sync.
function renderExemptions() {
  const checked = new Set([...form.querySelectorAll('input[name="exemption"]:checked')].map((node) => node.value));
  const W = WORKRULE[lang];
  const groups = EXEMPTION_GROUPS.map((group) => {
    const wrap = element('div', '', 'group');
    wrap.append(element('h3', W.group[group]));
    for (const e of EXEMPTIONS.filter((x) => x.group === group)) {
      const label = element('label', '', 'choice');
      const input = element('input');
      input.type = 'checkbox';
      input.name = 'exemption';
      input.value = e.id;
      input.checked = checked.has(e.id);
      input.addEventListener('change', renderSummary);
      label.append(input, document.createTextNode(` ${W.exemption[e.id]}`));
      wrap.append(label, element('small', e.proof.map((p) => W.proof[p]).join(', ')));
    }
    return wrap;
  });
  exemptionGroups.replaceChildren(...groups);
}

function readModel() {
  const jobs = readJobs();
  const otherHours = { school: toNumber(schoolHours.value), training: toNumber(trainingHours.value), volunteer: toNumber(volunteerHours.value) };
  const halfTimeSchool = halfTime.checked;
  const monthText = monthInput.value.trim();
  const validMonth = /^\d{4}-\d{2}$/.test(monthText) && monthOf(`${monthText}-01`) !== null;
  const month = validMonth ? monthText : (monthText ? null : previousMonth(todayIso()));
  const statement = {
    employerOrClient: wsEmployer.value.trim(), contact: wsContact.value.trim(), dates: wsDates.value.trim(), hours: wsHours.value.trim(), pay: wsPay.value.trim(),
  };
  return {
    who: { name: memberName.value.trim(), caseNumber: caseNumber.value.trim() },
    month,
    jobs,
    otherHours,
    halfTimeSchool,
    exemptions: [...form.querySelectorAll('input[name="exemption"]:checked')].map((node) => node.value),
    attachments: attachments.map(({ label, kind, bytes }) => ({ label, kind, bytes })),
    test: monthTest({ month, jobs, otherHours, halfTimeSchool }),
    workStatement: Object.values(statement).some(Boolean) ? statement : null,
    todayIso: todayIso(),
    lang,
    invalidMonth: Boolean(monthText) && !validMonth,
    outsideMonth: jobsOutsideMonth(month, jobs),
  };
}

// The one sentence that stops a build: a month typed in the wrong shape, or a pay date outside the month.
function monthProblem(model) {
  const T = UI[lang];
  if (model.invalidMonth) return T.monthFormat;
  const outside = model.outsideMonth[0];
  if (outside) return T.monthMismatch(outside.employer, outside.payDate, model.month);
  return '';
}

const hasSomething = (model) => model.jobs.length > 0 || model.test.hoursTotal > 0 || model.halfTimeSchool || model.exemptions.length > 0;

function renderSummary() {
  const model = readModel();
  const T = UI[lang];
  const W = WORKRULE[lang];
  const result = model.test;
  summaryEarned.textContent = T.summaryEarned(money.format(result.grossCents / 100));
  summaryHours.textContent = T.summaryHours(result.hoursTotal);
  summaryMeets.textContent = result.met ? T.summaryMeets(W.test[result.met]) : W.belowAll;
  const problem = monthProblem(model);
  summaryWarning.textContent = problem;
  summaryWarning.hidden = !problem;
  // The hospital check wants yearly income; the proven month times twelve is only a starting figure.
  if (!incomeTouched) incomeInput.value = result.grossCents ? String(Math.round((result.grossCents / 100) * 12)) : '';
}

function showError(text) {
  errorBox.textContent = text;
  errorBox.hidden = !text;
}

// Pay stub photo: the reader runs on the device; each thing it found gets a "Use this" button.
function setStubStatus(text) {
  stubStatus.textContent = text;
  stubStatus.hidden = text === '';
}

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

function targetRow() {
  const rows = [...jobsBox.querySelectorAll('.job')];
  return rows.find((row) => !row.querySelector('.job__employer').value && !row.querySelector('.job__gross').value) ?? addJobRow();
}

function showStubFindings(read) {
  const T = UI[lang];
  const row = targetRow();
  const set = (key, value) => { row.querySelector(`.job__${key}`).value = value; renderSummary(); };
  const items = [];
  if (read.employer) items.push(finding(T.foundEmployer(read.employer.value), '', () => set('employer', read.employer.value)));
  if (read.payDate) {
    items.push(finding(T.foundPayDate(read.payDate.value), read.payDate.source, () => {
      // A stub counts toward the month it was paid in; while the month picker is untouched, it follows the stub.
      if (!monthTouched && monthOf(read.payDate.value)) monthInput.value = monthOf(read.payDate.value);
      set('payDate', read.payDate.value);
    }));
  }
  if (read.periodStart && read.periodEnd) {
    items.push(finding(T.foundPeriod(read.periodStart.value, read.periodEnd.value), read.periodStart.source, () => {
      set('periodStart', read.periodStart.value);
      set('periodEnd', read.periodEnd.value);
    }));
  }
  if (read.hours) items.push(finding(T.foundHours(read.hours.value), read.hours.source, () => set('hours', String(read.hours.value))));
  if (read.grossCents) items.push(finding(T.foundGross(money.format(read.grossCents.value / 100)), read.grossCents.source, () => set('gross', (read.grossCents.value / 100).toFixed(2))));
  stubFindings.replaceChildren(...items);
  stubFindings.hidden = items.length === 0;
  setStubStatus(items.length === 0 ? T.stubNothing : '');
}

stubPhoto.addEventListener('change', async () => {
  const file = stubPhoto.files?.[0];
  if (!file) return;
  stubFindings.hidden = true;
  setStubStatus(UI[lang].photoLoading);
  try {
    const text = await readBillImage(file, { onProgress: (p) => setStubStatus(UI[lang].photoReading(Math.round(p * 100))) });
    const read = readStub(text);
    showStubFindings(read);
    await addAttachment(file, UI[lang].stubLabel(read.payDate?.value ?? ''));
  } catch {
    setStubStatus(UI[lang].photoFailed);
  }
  stubPhoto.value = '';
});

// Attachments. Photos are redrawn as JPEG no wider than MAX_IMAGE_EDGE before the PDF sees them;
// that is also what makes phone formats the PDF library cannot embed work.
async function prepareAttachment(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Open it now, so a damaged or password-protected PDF is refused at the row, not at the build.
    const { PDFDocument } = await import('../vendor/pdf-lib/pdf-lib.esm.min.js');
    await PDFDocument.load(bytes);
    return { kind: 'pdf', bytes };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('no jpeg');
  return { kind: 'jpeg', bytes: new Uint8Array(await blob.arrayBuffer()) };
}

async function addAttachment(file, label) {
  try {
    const { kind, bytes } = await prepareAttachment(file);
    attachments = [...attachments, { id: nextId++, name: file.name, label: label || file.name.replace(/\.[^.]+$/, ''), kind, bytes }];
    renderAttachments();
  } catch {
    showError(UI[lang].attachFailed(file.name));
  }
}

attachmentFiles.addEventListener('change', async () => {
  showError('');
  for (const file of attachmentFiles.files ?? []) await addAttachment(file, '');
  attachmentFiles.value = '';
});

function renderAttachments() {
  const T = UI[lang];
  attachmentsList.replaceChildren(...attachments.map((a) => {
    const item = element('li');
    const label = element('input');
    label.type = 'text';
    label.value = a.label;
    label.setAttribute('aria-label', T.attachLabel);
    label.addEventListener('input', () => {
      attachments = attachments.map((x) => (x.id === a.id ? { ...x, label: label.value } : x));
    });
    const remove = element('button', T.removeAttachment, 'check__button check__button--quiet');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      attachments = attachments.filter((x) => x.id !== a.id);
      renderAttachments();
    });
    item.append(label, element('small', `${a.name} (${a.kind})`), remove);
    return item;
  }));
  renderSummary();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

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
  downloadBlob(new Blob([text], { type: 'text/plain' }), filename);
}

// Build the packet. The PDF library is half a megabyte, so it loads only when someone gets this far.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const model = readModel();
  const problem = monthProblem(model);
  if (problem) { showError(problem); return; }
  if (!hasSomething(model)) {
    showError(UI[lang].needSomething);
    return;
  }
  buildButton.disabled = true;
  try {
    const { PDFDocument, StandardFonts } = await import('../vendor/pdf-lib/pdf-lib.esm.min.js');
    const bytes = await buildPacket(model, PDFDocument, StandardFonts);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), PACKET_FILE);
  } catch {
    showError(UI[lang].buildFailed);
  } finally {
    buildButton.disabled = false;
  }
});

// The record carries the device's own clock, as typed, so it never shifts across time zones.
function localIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

recordButton.addEventListener('click', () => {
  showError('');
  const model = readModel();
  if (model.invalidMonth) { showError(UI[lang].monthFormat); return; }
  try {
    openText(counselorRecord({ model, nowIso: localIso(), lang }), RECORD_FILE, UI[lang].recordTitle);
  } catch {
    showError(UI[lang].buildFailed);
  }
});

// Start over leaves nothing behind for the next person at the desk.
function startOver() {
  form.reset();
  jobsBox.replaceChildren();
  addJobRow();
  attachments = [];
  stubFindings.replaceChildren();
  stubFindings.hidden = true;
  setStubStatus('');
  monthInput.value = previousMonth(todayIso());
  householdSize.value = '';
  incomeInput.value = '';
  incomeTouched = false;
  monthTouched = false;
  showError('');
  try { sessionStorage.removeItem('freecare-handoff'); } catch { /* storage off */ }
  renderExemptions();
  renderAttachments();
}
startOverButton.addEventListener('click', startOver);

// Hand the household numbers to the bill page in the same tab; it reads them once and forgets them.
incomeInput.addEventListener('input', () => { incomeTouched = true; });
toBill.addEventListener('click', () => {
  try {
    sessionStorage.setItem('freecare-handoff', JSON.stringify({ householdSize: householdSize.value.trim(), income: incomeInput.value.trim() }));
  } catch { /* storage off: the bill page simply starts blank */ }
  window.location.href = 'index.html';
});

function setLanguage(next) {
  lang = next;
  applyLanguage(document, lang);
  document.title = textFor(lang, 'renew.title');
  rememberLanguage(lang);
  relabelJobs();
  renderExemptions();
  renderAttachments();
}
langToggle.addEventListener('click', () => setLanguage(lang === 'en' ? 'es' : 'en'));

document.getElementById('state-phone').textContent = RULES.phone;
monthInput.value = previousMonth(todayIso());
addJobRow();
[schoolHours, trainingHours, volunteerHours, memberName, caseNumber, monthInput].forEach((node) => node.addEventListener('input', renderSummary));
monthInput.addEventListener('input', () => { monthTouched = true; });
halfTime.addEventListener('change', renderSummary);
addJobButton.addEventListener('click', () => addJobRow());
setLanguage(pickLanguage(savedLanguage(), navigator.language));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
