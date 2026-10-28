import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const count = (text, pattern) => (text.match(pattern) || []).length;

test('without JavaScript the button stays off, so answers never land in the URL', () => {
  assert.match(html, /<button type="submit" class="check__button" disabled>/);
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
