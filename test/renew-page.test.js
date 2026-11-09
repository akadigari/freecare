import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../renew.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../src/renew.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('the renewal page has the controls the script expects, and loads only its own files', () => {
  for (const id of ['lang-toggle', 'renew-form', 'memberName', 'caseNumber', 'month', 'jobs', 'add-job', 'stubPhoto', 'stub-findings', 'schoolHours', 'trainingHours', 'volunteerHours', 'halfTimeSchool', 'exemptions', 'attachments', 'attachmentFiles', 'work-statement', 'summary', 'build-button', 'record-button', 'start-over', 'handoff', 'householdSize', 'income', 'to-bill', 'renew-error', 'state-tool-link']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<script type="module" src="src\/renew\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="src\/styles\.css">/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
  assert.match(html, /href="index\.html"/);
  assert.match(html, /<input id="month" name="month" type="month"/);
  assert.match(html, /<input id="attachmentFiles"[^>]*multiple/);
});

test('the script never fetches anything but its own files, converts photos itself, and start-over clears the handoff', () => {
  assert.doesNotMatch(js, /fetch\(\s*['"`]https?:/);
  assert.doesNotMatch(js, /https?:\/\//, 'outside addresses live in strings.js and workrule.js, not here');
  assert.match(js, /createImageBitmap|new Image\(/);
  assert.match(js, /MAX_IMAGE_EDGE/);
  assert.match(js, /toBlob\([^)]*image\/jpeg/);
  assert.match(js, /sessionStorage\.removeItem\('freecare-handoff'\)/);
  assert.match(js, /sessionStorage\.setItem\('freecare-handoff'/);
  assert.match(js, /\.reset\(\)/);
  assert.match(js, /import\('\.\.\/vendor\/pdf-lib\/pdf-lib\.esm\.min\.js'\)/);
  assert.match(js, /readBillImage\(/);
  assert.match(js, /readStub\(/);
  assert.match(js, /buildPacket\(/);
  assert.match(js, /counselorRecord\(/);
  assert.match(js, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
});

test('the worker caches the renewal page and its modules under a new cache name', () => {
  assert.match(sw, /const CACHE = 'freecare-3'/);
  for (const file of ['renew.html', 'src/renew.js', 'src/workrule.js', 'src/stub.js', 'src/packet.js', 'src/record.js']) assert.match(sw, new RegExp(`'${file.replace('.', '\\.')}'`), file);
});

test('the page never claims to decide, and names the state tool and the phone line', () => {
  assert.doesNotMatch(html, /you are exempt|you qualify|you are safe|you comply/i);
  assert.match(html, /Maryland Health Connection makes the decision/);
  assert.doesNotMatch(html, /\u2014|\u2013/);
});

test('the script guards the month, flags pay dates outside it, checks PDFs when attached, and never crashes the record button', () => {
  assert.match(js, /jobsOutsideMonth\(/);
  assert.match(js, /monthFormat/);
  assert.match(js, /monthMismatch/);
  assert.match(js, /PDFDocument\.load\(/);
  assert.match(js, /try \{[^}]*counselorRecord\(/);
  assert.match(html, /Nothing you enter is saved after you close the page\./);
  for (const id of ['exemption-groups', 'stub-status', 'summary-earned', 'summary-hours', 'summary-meets', 'wsEmployer', 'wsContact', 'wsDates', 'wsHours', 'wsPay', 'state-phone']) assert.match(html, new RegExp(`id="${id}"`), id);
});
