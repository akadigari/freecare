import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));

function precacheList() {
  const block = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(block, 'sw.js lists what it caches on install');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('everything the worker caches on install is a real file in this repo', () => {
  const files = precacheList();
  assert.ok(files.length >= 15, `only ${files.length} files`);
  for (const file of files) {
    if (file === './') continue;
    assert.ok(existsSync(new URL(file, root)), `${file} is listed but missing`);
  }
});

test('every page module is cached, so the page works offline after one visit', () => {
  const files = new Set(precacheList());
  for (const name of readdirSync(new URL('src/', root))) {
    assert.ok(files.has(`src/${name}`), `src/${name} is not precached`);
  }
  for (const must of ['./', 'index.html', 'manifest.json', 'forms/md-uniform-financial-assistance-2026-03-06.pdf', 'vendor/pdf-lib/pdf-lib.esm.min.js']) {
    assert.ok(files.has(must), must);
  }
  assert.ok(![...files].some((f) => f.includes('tesseract')), 'the 13 MB reader is cached when first used, not up front');
});

test('the worker touches only this site', () => {
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /caches\.delete\(/, 'old caches are cleaned up');
});

test('the page registers the worker and can be added to a home screen', () => {
  assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(html, /<meta name="theme-color"/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(icon.src, root)), icon.src);
    assert.match(icon.sizes, /^\d+x\d+$/);
  }
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
  assert.doesNotMatch(JSON.stringify(manifest), /—/);
});
