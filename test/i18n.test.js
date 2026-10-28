import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE, UI, ERRORS_ES, RESULT, LANGS } from '../src/strings.js';
import { pickLanguage, translateError, textFor } from '../src/i18n.js';
import { FAILED_MESSAGE } from '../src/check.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('../src/form.js', import.meta.url), 'utf8');
const datesSource = readFileSync(new URL('../src/dates.js', import.meta.url), 'utf8');

const keysInHtml = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
const placeholderKeys = [...html.matchAll(/data-i18n-placeholder="([^"]+)"/g)].map((m) => m[1]);

test('every marked element on the page has English and Spanish text', () => {
  assert.ok(keysInHtml.length >= 30, `only ${keysInHtml.length} marked elements`);
  for (const key of [...keysInHtml, ...placeholderKeys]) {
    for (const lang of LANGS) assert.ok(PAGE[lang][key], `${lang} is missing ${key}`);
  }
});

test('the English on the page is the English in strings.js, so neither drifts', () => {
  for (const match of html.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
    const [, key, text] = match;
    assert.equal(text.trim(), PAGE.en[key], key);
  }
  for (const match of html.matchAll(/data-i18n-placeholder="([^"]+)"[^>]*placeholder="([^"]*)"/g)) {
    const [, key, text] = match;
    assert.equal(text, PAGE.en[key], key);
  }
});

test('Spanish is a translation, not a copy', () => {
  const same = Object.keys(PAGE.en).filter((key) => PAGE.en[key] === PAGE.es[key]);
  assert.deepEqual(same.sort(), ['no', 'wic']);
  for (const key of Object.keys(PAGE.en)) assert.ok(PAGE.es[key].length > 0, key);
});

test('every error the form can show has a Spanish version', () => {
  const quoted = /error: (?:'([^']+)'|"([^"]+)")/g;
  const messages = [...formSource.matchAll(quoted)].map((m) => m[1] ?? m[2])
    .concat([...datesSource.matchAll(/Error\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]));
  messages.push('Enter an amount like 60,000.', 'Enter how many people live in your household, from 1 to 20.', FAILED_MESSAGE);
  for (const message of messages) {
    assert.ok(ERRORS_ES[message], `no Spanish for: ${message}`);
    assert.equal(translateError(message, 'es'), ERRORS_ES[message]);
    assert.equal(translateError(message, 'en'), message);
  }
  assert.equal(translateError('something new', 'es'), 'something new');
});

test('the language comes from the saved choice, then the browser, then English', () => {
  assert.equal(pickLanguage('es', 'en-US'), 'es');
  assert.equal(pickLanguage(null, 'es-MX'), 'es');
  assert.equal(pickLanguage(null, 'en-US'), 'en');
  assert.equal(pickLanguage('fr', 'es'), 'es');
  assert.equal(pickLanguage(undefined, undefined), 'en');
});

test('textFor fills a page key or a UI key in either language', () => {
  assert.equal(textFor('en', 'check.button'), 'Check my bill');
  assert.equal(textFor('es', 'check.button'), 'Revisar mi factura');
  assert.equal(UI.es.personName(3), 'Nombre de la persona 3');
  assert.equal(RESULT.es.stamp.reduced(75), '75% MENOS');
});
