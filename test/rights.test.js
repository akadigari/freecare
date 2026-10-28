import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIGHTS_SOURCE, HELP_LINKS, rightsFor } from '../src/rights.js';
import { RIGHTS } from '../src/strings.js';

test('the rights come from the collection statute, read on a known date', () => {
  assert.equal(RIGHTS_SOURCE.label, 'Maryland Health-General § 19-214.2');
  assert.match(RIGHTS_SOURCE.url, /^https:\/\/mgaleg\.maryland\.gov\/.*section=19-214\.2/);
  assert.match(RIGHTS_SOURCE.readOn, /^\d{4}-\d{2}-\d{2}$/);
});

test('help goes to the state, never to a phone number that could be wrong', () => {
  assert.equal(HELP_LINKS.length, 2);
  for (const link of HELP_LINKS) {
    assert.match(link.url, /^https:\/\/(hscrc|oag)\.maryland\.gov\//);
    assert.ok(link.id);
  }
  const everything = JSON.stringify(RIGHTS);
  assert.doesNotMatch(everything, /\d{3}[-.\s]\d{3}[-.\s]\d{4}/, 'no phone numbers');
  assert.doesNotMatch(everything, /\u2014/, 'no em dashes');
});

test('three situations, in plain English, with the numbers the law uses', () => {
  const en = rightsFor('en');
  assert.equal(en.title, "What the hospital can't do to you");
  assert.deepEqual(en.groups.map((g) => g.heading), ['You already paid', "They're threatening to sue, or to hurt your credit", 'They want a payment plan']);
  const text = en.groups.map((g) => g.text).join(' ');
  assert.match(text, /\$25/);
  assert.match(text, /240 days/);
  assert.match(text, /\$500 or less/);
  assert.match(text, /garnish/);
  assert.match(text, /5% of your monthly/);
  assert.match(text, /lien|your home/);
  assert.match(text, /45 days/);
  assert.equal(en.help.length, 2);
  assert.equal(en.help[0].url, HELP_LINKS[0].url);
  assert.equal(en.source.url, RIGHTS_SOURCE.url);
});

test('Spanish has the same shape and the same numbers', () => {
  const en = rightsFor('en');
  const es = rightsFor('es');
  assert.equal(es.groups.length, en.groups.length);
  assert.notEqual(es.title, en.title);
  es.groups.forEach((g, i) => assert.notEqual(g.text, en.groups[i].text, `group ${i} untranslated`));
  for (const number of ['$25', '240', '$500', '5%', '45']) assert.match(es.groups.map((g) => g.text).join(' '), new RegExp(number.replace('$', '\\$')));
  assert.equal(rightsFor('fr').title, en.title, 'unknown languages fall back to English');
});
