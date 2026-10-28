import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const count = (text, pattern) => (text.match(pattern) || []).length;

test('without JavaScript the button stays off, so answers never land in the URL', () => {
  assert.match(html, /<button type="submit" class="check__button" disabled[^>]*>/);
  assert.match(html, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
  assert.match(app, /button\.disabled = false/);
});

test('screen readers hear the residency error and the programs hint', () => {
  assert.match(html, /id="resident-error"/);
  assert.equal(count(html, /name="resident"[^>]*aria-describedby="resident-error"/g), 2);
  assert.match(html, /id="programs-hint"/);
  assert.equal(count(html, /type="checkbox"[^>]*aria-describedby="programs-hint"/g), 4);
});

test('hints do not overstate the rules', () => {
  assert.match(html, /If you live in Maryland, any one of these means your care should be free\./);
  assert.match(html, /above 300% of the poverty line/);
  assert.doesNotMatch(html, /you may get a bigger discount/);
});

test('the page has a whole-form error slot and uses the tested check', () => {
  assert.match(html, /<p class="error" id="form-error" role="alert" hidden><\/p>/);
  assert.match(app, /runCheck\(/);
  assert.match(app, /validity\.badInput/);
});

test('the page says who made it and how to reach them', () => {
  assert.match(html, /Made by Ayush Kadigari/);
  assert.match(html, /arkadigari@gmail\.com/);
  assert.match(html, /not a hospital and not a lawyer/i);
});

test('after the result, the page can fill the state application without leaving the browser', () => {
  assert.match(html, /<section id="apply"[^>]*hidden>/);
  assert.match(html, /name="applicantName"/);
  assert.match(html, /name="street"/);
  assert.match(html, /name="city"/);
  assert.match(html, /name="zip"/);
  assert.match(html, /name="phone"/);
  assert.match(html, /id="members"/);
  assert.match(html, /id="apply-button"/);
  assert.match(html, /The signature line stays blank/);
  assert.match(app, /from '\.\/apply\.js'/);
  assert.match(app, /import\('\.\.\/vendor\/pdf-lib\/pdf-lib\.esm\.min\.js'\)/, 'pdf-lib loads only when someone fills the application');
  assert.doesNotMatch(app, /from '\.\.\/vendor\/pdf-lib/, 'no eager import of the 523 KB library');
  assert.match(app, /fetch\(FORM\.file\)/);
});

test('the application asks about Medicaid and large assets', () => {
  assert.match(html, /name="medicaid" value="yes"/);
  assert.match(html, /name="medicaid" value="no"/);
  assert.match(html, /name="medicaidDate"/);
  assert.match(html, /name="medicaidDetermination"/);
  assert.match(html, /name="assets"/);
});

test('the page loads only its own files', () => {
  const imports = app.match(/from '([^']+)'/g) || [];
  for (const line of imports) assert.match(line, /from '\.{1,2}\//, line);
  for (const line of app.match(/import\('([^']+)'\)/g) || []) assert.match(line, /import\('\.{1,2}\//, line);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(js|css)/);
  assert.doesNotMatch(app, /https?:\/\//);
});

test('the result is printed with a stamp the screen reader skips', () => {
  assert.match(app, /verdict__stamp/);
  assert.match(app, /ariaHidden = 'true'|aria-hidden/);
});

test('the page can switch to Spanish', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /id="lang-toggle"[^>]*data-i18n="lang.toggle"/);
  assert.match(app, /from '\.\/i18n\.js'/);
  assert.match(app, /applyLanguage\(/);
  assert.doesNotMatch(html, /data-i18n="[^"]*"[^>]*>[^<]*<a /, 'a marked element must not contain a link');
});

test('a result can be printed and its deadline saved to a calendar', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media print/);
  assert.match(css, /@media print[\s\S]*\.check\b[\s\S]*display: none/);
  assert.match(css, /@media print[\s\S]*\.apply\b[\s\S]*display: none/);
  assert.match(app, /verdict__actions/);
  assert.match(app, /window\.print\(\)/);
  assert.match(app, /from '\.\/calendar\.js'/);
  assert.match(app, /CALENDAR_FILE/);
});

test('a photo of the bill is read on the device, never uploaded', () => {
  assert.match(html, /<input id="billPhoto" name="billPhoto" type="file" accept="image\/\*" capture="environment"/);
  assert.match(html, /id="photo-findings"/);
  assert.match(app, /from '\.\/ocr\.js'/);
  assert.match(app, /from '\.\/bill\.js'/);
  const ocr = readFileSync(new URL('../src/ocr.js', import.meta.url), 'utf8');
  assert.match(ocr, /import\('\.\.\/vendor\/tesseract\/tesseract\.esm\.min\.js'\)/, 'the recognizer loads only when a photo is picked');
  assert.doesNotMatch(ocr, /https?:\/\//, 'no CDN');
  assert.match(ocr, /worker\.terminate\(\)/);
  for (const file of ['tesseract.esm.min.js', 'worker.min.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js', 'lang/eng.traineddata.gz']) {
    assert.doesNotThrow(() => readFileSync(new URL(`../vendor/tesseract/${file}`, import.meta.url)), file);
  }
});
