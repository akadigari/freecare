// What a Maryland hospital may not do to collect a bill, from the collection statute.
// The wording lives in strings.js; this file holds the sources and puts a block together.

import { RIGHTS } from './strings.js';

export const RIGHTS_SOURCE = Object.freeze({
  label: 'Maryland Health-General § 19-214.2',
  url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&section=19-214.2&enactments=false',
  readOn: '2026-10-28',
});

// State pages only. A phone number can change or be typed wrong; a state link gets fixed by the state.
export const HELP_LINKS = Object.freeze([
  Object.freeze({ id: 'hscrc', url: 'https://hscrc.maryland.gov/Pages/consumers.aspx' }),
  Object.freeze({ id: 'heau', url: 'https://oag.maryland.gov/our-office/Pages/heau.aspx' }),
]);

export function rightsFor(lang) {
  const T = RIGHTS[lang] ?? RIGHTS.en;
  const longDate = new Intl.DateTimeFormat(T.locale, { dateStyle: 'long', timeZone: 'UTC' });
  const readOn = longDate.format(new Date(`${RIGHTS_SOURCE.readOn}T00:00:00Z`));
  return Object.freeze({
    title: T.title,
    intro: T.intro,
    items: Object.freeze([...T.items]),
    helpIntro: T.helpIntro,
    help: Object.freeze(HELP_LINKS.map((link) => Object.freeze({ ...link, label: T.help[link.id] }))),
    source: Object.freeze({ ...RIGHTS_SOURCE, before: T.sourceBefore, after: T.sourceAfter(readOn) }),
  });
}
