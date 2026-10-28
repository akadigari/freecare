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
  assert.match(app, /from '\.\.\/vendor\/pdf-lib\/pdf-lib\.esm\.min\.js'/);
  assert.match(app, /fetch\(FORM\.file\)/);
});

test('the page loads only its own files', () => {
  const imports = app.match(/from '([^']+)'/g) || [];
  for (const line of imports) assert.match(line, /from '\.{1,2}\//, line);
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
