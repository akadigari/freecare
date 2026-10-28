import { PAGE, ERRORS_ES, LANGS } from './strings.js';

// Saved choice first, then the browser's language, then English.
export function pickLanguage(saved, browserLanguage) {
  if (LANGS.includes(saved)) return saved;
  const guess = String(browserLanguage ?? '').slice(0, 2).toLowerCase();
  return LANGS.includes(guess) ? guess : 'en';
}

export function textFor(lang, key) {
  return PAGE[lang]?.[key] ?? PAGE.en[key] ?? '';
}

// Form errors are written in English; Spanish comes from a lookup. Unknown text passes through.
export function translateError(message, lang) {
  if (lang !== 'es') return message;
  return ERRORS_ES[message] ?? message;
}

// Rewrites every marked element on the page. Markup inside marked elements is replaced by text,
// so links and inputs are never put inside a marked element.
export function applyLanguage(doc, lang) {
  doc.documentElement.lang = lang;
  for (const node of doc.querySelectorAll('[data-i18n]')) {
    node.textContent = textFor(lang, node.dataset.i18n);
  }
  for (const node of doc.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = textFor(lang, node.dataset.i18nPlaceholder);
  }
}
