import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOSPITALS, HOSPITALS_SOURCE, hospitalById } from '../src/hospitals.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the list comes from the state and every policy link points at the state site', () => {
  assert.match(HOSPITALS_SOURCE.url, /^https:\/\/hscrc\.maryland\.gov\//);
  assert.match(HOSPITALS_SOURCE.readOn, /^2026-\d\d-\d\d$/);
  assert.ok(HOSPITALS.length >= 18, `only ${HOSPITALS.length} hospitals`);
  for (const hospital of HOSPITALS) {
    assert.match(hospital.id, /^[a-z0-9-]+$/, hospital.name);
    assert.ok(hospital.name.length > 3, hospital.id);
    assert.match(hospital.policyUrl, /^https:\/\/hscrc\.maryland\.gov\/Documents\//, hospital.name);
    assert.doesNotMatch(hospital.policyUrl, /\s/, hospital.name);
    assert.ok(['financial assistance', 'billing and collection'].includes(hospital.policyKind), hospital.name);
    assert.ok(['pdf', 'word'].includes(hospital.fileType), hospital.name);
  }
});

test('ids and names are unique and the list is in alphabetical order', () => {
  const ids = HOSPITALS.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = HOSPITALS.map((h) => h.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')));
});

test('a hospital can be found by id, and nothing else is', () => {
  const first = HOSPITALS[0];
  assert.equal(hospitalById(first.id), first);
  assert.equal(hospitalById('nowhere-general'), null);
  assert.equal(hospitalById(''), null);
});

test('no phone numbers are shipped, because a wrong one does harm', () => {
  for (const hospital of HOSPITALS) {
    assert.doesNotMatch(JSON.stringify(hospital), /\d{3}[-.) ]\d{3}[-. ]\d{4}/, hospital.name);
  }
});

test('the page has a hospital picker next to the application', () => {
  assert.match(html, /<select id="hospital" name="hospital"/);
  assert.match(html, /id="hospital-help"/);
});
