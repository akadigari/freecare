import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const lightBlock = css.match(/:root\s*\{([^}]*)\}/)[1];
const darkBlock = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)[1];
const token = (block, name) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

test('hint text is readable: at least 4.5:1 against the page in both modes', () => {
  assert.ok(contrast(token(lightBlock, 'muted'), token(lightBlock, 'card')) >= 4.5, 'light');
  assert.ok(contrast(token(darkBlock, 'muted'), token(darkBlock, 'card')) >= 4.5, 'dark');
});

test('focus ring is at least 3:1 against the page in light mode', () => {
  for (const background of ['card', 'paper']) {
    assert.ok(contrast(token(lightBlock, 'focus'), token(lightBlock, background)) >= 3, background);
  }
});

test('focus ring is at least 3:1 against the page in dark mode', () => {
  const focus = token(darkBlock, 'focus') ?? token(lightBlock, 'focus');
  for (const background of ['card', 'paper']) {
    assert.ok(contrast(focus, token(darkBlock, background)) >= 3, background);
  }
});
