import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { coverLines, memberSheetLines, workStatementLines, wrapLines, safeText, buildPacket, PACKET_FILE, MAX_IMAGE_EDGE, ATTACHMENT_KINDS } from '../src/packet.js';
import { monthTest } from '../src/workrule.js';

// A 1x1 white PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');

const jobs = [{ employer: 'Blue Crab Diner LLC', grossCents: 128650, hours: 80, payDate: '2027-01-09', periodStart: '2026-12-22', periodEnd: '2027-01-04' }];
const model = {
  who: { name: 'Dana Example', caseNumber: 'MHC-123' },
  month: '2027-01',
  jobs,
  otherHours: { school: 0, training: 0, volunteer: 12 },
  halfTimeSchool: false,
  exemptions: [],
  attachments: [{ label: 'Pay stub Jan 9', kind: 'png', bytes: PNG }],
  test: monthTest({ month: '2027-01', jobs, otherHours: { volunteer: 12 } }),
  workStatement: null,
  todayIso: '2027-01-12',
  lang: 'en',
};

test('the cover sheet carries the month, the arithmetic, the straddle, the count and the decides sentence', () => {
  const lines = coverLines(model);
  assert.equal(lines[0], 'Proof of work for Medicaid, January 2027');
  assert.ok(lines.includes('Name: Dana Example'));
  assert.ok(lines.includes('Case or notice number: MHC-123'));
  assert.ok(lines.includes('Earned from jobs this month: $1,286.50 (the test is at least $580)'));
  assert.ok(lines.includes('Blue Crab Diner LLC: $1,286.50 gross, 80 hours, paid January 9, 2027 for December 22, 2026 to January 4, 2027'));
  assert.ok(lines.includes('Hours this month: 92 (the test is 80 hours of work, school, job training or volunteering)'));
  assert.ok(lines.includes('work 80, volunteering 12'));
  assert.ok(lines.includes('Meets: at least $580 from a job'));
  assert.ok(lines.includes('Documents attached: 1'));
  assert.ok(lines.includes('1. Pay stub Jan 9'));
  assert.ok(lines.includes('Date: January 12, 2027'));
  assert.ok(lines.includes('This is my own summary. Maryland Health Connection makes the decision.'));
  assert.match(lines.at(-1), /^Signature: _+$/);
  assert.ok(!lines.some((l) => /School at least half-time/.test(l)));
  assert.ok(!lines.some((l) => /undefined|null|NaN|\u2014/.test(l)));
});

test('nothing met still produces a cover sheet that says so, and the Spanish member sheet exists only for Spanish', () => {
  const none = { ...model, jobs: [], otherHours: { volunteer: 10 }, test: monthTest({ month: '2027-01', otherHours: { volunteer: 10 } }) };
  const lines = coverLines(none);
  assert.ok(lines.includes('Below each threshold for this month'));
  assert.ok(lines.includes('Earned from jobs this month: $0.00 (the test is at least $580)'));
  const es = memberSheetLines(model, 'es');
  assert.match(es[0], /paquete/i);
  assert.ok(es.some((l) => /\$1,286\.50/.test(l)));
  assert.ok(!es.some((l) => /\u2014/.test(l)));
});

test('the work statement is only there when asked for, and names both signers', () => {
  assert.deepEqual(workStatementLines(model), []);
  const lines = workStatementLines({ ...model, workStatement: { employerOrClient: 'Mr. Reyes', contact: '240-555-0100', dates: 'Jan 3, 10, 17, 2027', hours: '18', pay: '$240 cash' } });
  assert.equal(lines[0], 'Statement of work');
  assert.ok(lines.includes('Employer or client: Mr. Reyes'));
  assert.ok(lines.includes('I confirm that the above is true to the best of my knowledge.'));
  assert.ok(lines.some((l) => /^Worker signature and date: _+$/.test(l)));
  assert.ok(lines.some((l) => /^Employer or client signature and date: _+$/.test(l)));
});

test('wrapLines keeps every line inside the width and breaks a word that is too long', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = wrapLines('one two three four five six seven eight nine ten eleven twelve', font, 11, 120);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(font.widthOfTextAtSize(line, 11) <= 120, line);
  const broken = wrapLines('a'.repeat(200), font, 11, 120);
  assert.ok(broken.length > 1);
  assert.equal(broken.join(''), 'a'.repeat(200));
});

test('the packet is a Letter PDF: cover, then one page per attachment, more pages for Spanish and the statement', async () => {
  const bytes = await buildPacket(model, PDFDocument, StandardFonts);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  const { width, height } = doc.getPage(0).getSize();
  assert.deepEqual([Math.round(width), Math.round(height)], [612, 792]);
  const more = await buildPacket({ ...model, lang: 'es', workStatement: { employerOrClient: 'x', contact: 'y', dates: 'z', hours: '1', pay: '2' } }, PDFDocument, StandardFonts);
  assert.equal((await PDFDocument.load(more)).getPageCount(), 4);
  // pdf-lib saves a document with no pages as one blank page, so the smallest PDF attachment is one page.
  const letter = await PDFDocument.create();
  letter.addPage([612, 792]);
  const pdfAttachment = { label: 'School letter', kind: 'pdf', bytes: await letter.save() };
  const withPdf = await buildPacket({ ...model, attachments: [pdfAttachment] }, PDFDocument, StandardFonts);
  assert.equal((await PDFDocument.load(withPdf)).getPageCount(), 2, 'a one-page PDF adds one page after the cover');
  await assert.rejects(() => buildPacket({ ...model, attachments: [{ label: 'x', kind: 'heic', bytes: PNG }] }, PDFDocument, StandardFonts), /Cannot attach heic/);
  assert.equal(PACKET_FILE, 'medicaid-proof-packet.pdf');
  assert.equal(MAX_IMAGE_EDGE, 1600);
  assert.deepEqual([...ATTACHMENT_KINDS], ['jpeg', 'png', 'pdf']);
});

test('names the standard font cannot encode are made safe at draw time, never a failed build', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  assert.equal(safeText('Nguy\u1ec5n V\u0103n An', font), 'Nguyen Van An');
  assert.equal(safeText('\u5f20\u4f1f', font), '??');
  assert.equal(safeText('Jos\u00e9 \u00d1and\u00fa', font), 'Jos\u00e9 \u00d1and\u00fa', 'Latin-1 letters pass through unchanged');
  const who = { name: 'Nguy\u1ec5n V\u0103n An \u5f20\u4f1f', caseNumber: '\u0141ukasz-1' };
  const bytes = await buildPacket({ ...model, who, jobs: [{ ...jobs[0], employer: '\u0218tefan & Co.' }], attachments: [{ label: 'Pay stub \u2605', kind: 'png', bytes: PNG }] }, PDFDocument, StandardFonts);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2);
  assert.ok(coverLines({ ...model, who }).includes('Name: Nguy\u1ec5n V\u0103n An \u5f20\u4f1f'), 'the text lines keep the real name');
});

test('a month that is not YYYY-MM is printed as typed instead of crashing', () => {
  const lines = coverLines({ ...model, month: 'October 2026' });
  assert.equal(lines[0], 'Proof of work for Medicaid, October 2026');
  assert.doesNotThrow(() => memberSheetLines({ ...model, month: '10/2026' }, 'es'));
});
