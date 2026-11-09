// Builds the proof packet: a cover sheet a caseworker can read in thirty seconds, then the
// documents behind it, one per page. The cover sheet is always English; a Spanish member sheet
// is added when the page is in Spanish. pdf-lib is passed in, the way apply.js takes it, so the
// page and the tests load it the same way. Nothing here touches the network.

import { exemptionsById } from './workrule.js';
import { WORKRULE, PACKET } from './strings.js';
import { jobLine, hoursBreakdown } from './record.js';

export const PACKET_FILE = 'medicaid-proof-packet.pdf';
export const MAX_IMAGE_EDGE = 1600; // the page scales photos to this long edge before attaching
export const ATTACHMENT_KINDS = Object.freeze(['jpeg', 'png', 'pdf']);

const PAGE = Object.freeze({ width: 612, height: 792, margin: 54, size: 11, leading: 16, titleSize: 18, labelSize: 10 });
const SIGN = '______________________';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const clean = (value) => String(value ?? '').trim();

function words(lang) {
  const T = PACKET[lang] ?? PACKET.en;
  const W = WORKRULE[lang] ?? WORKRULE.en;
  const day = new Intl.DateTimeFormat(T.locale, { dateStyle: 'long', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat(T.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
  return {
    T,
    W,
    date: (iso) => day.format(new Date(`${iso}T00:00:00Z`)),
    monthName: (ym) => (/^\d{4}-\d{2}$/.test(String(ym ?? '')) ? month.format(new Date(`${ym}-01T00:00:00Z`)) : String(ym ?? '')),
  };
}

function canEncode(text, font) {
  try { font.encodeText(text); return true; } catch { return false; }
}

// The standard fonts know only Latin-1 (WinAnsi). Letters outside it lose their marks (Nguyen
// for Nguyen with tone marks), and anything else becomes a question mark, so a name never breaks the build.
export function safeText(text, font) {
  const whole = String(text ?? '');
  if (canEncode(whole, font)) return whole;
  const out = [];
  for (const ch of whole) {
    if (canEncode(ch, font)) { out.push(ch); continue; }
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '');
    out.push(base && base !== ch && canEncode(base, font) ? base : '?');
  }
  return out.join('');
}

// The facts of the month, in one language. The cover sheet and the member sheet share them.
function factLines(model, lang, title) {
  const { T, W, date, monthName } = words(lang);
  const who = model.who ?? {};
  const result = model.test ?? {};
  const attachments = model.attachments ?? [];
  const breakdown = hoursBreakdown(model, lang);
  const lines = [
    title(model.month ? monthName(model.month) : ''),
    clean(who.name) ? `${T.name}: ${clean(who.name)}` : null,
    clean(who.caseNumber) ? `${T.caseNumber}: ${clean(who.caseNumber)}` : null,
    T.earned(money.format((result.grossCents ?? 0) / 100)),
    ...(model.jobs ?? []).map((job) => jobLine(job, lang)),
    T.hours(result.hoursTotal ?? 0),
    breakdown || null,
    model.halfTimeSchool ? T.halfTime : null,
    result.met ? `${T.meets}: ${W.test[result.met]}` : W.belowAll,
    ...exemptionsById(model.exemptions).map((e) => `${T.exemption}: ${W.exemption[e.id]}`),
    T.attached(attachments.length),
    ...attachments.map((a, i) => `${i + 1}. ${clean(a.label) || T.unnamedFile}`),
    model.todayIso ? `${T.date}: ${date(model.todayIso)}` : null,
    W.decides,
    `${T.signature}: ${SIGN}`,
  ];
  return lines.filter((line) => line !== null && line !== '');
}

// Page one, always in English, for the caseworker.
export function coverLines(model) {
  return factLines(model, 'en', PACKET.en.title);
}

// The same facts in the member's language, headed "What is in this packet".
export function memberSheetLines(model, lang) {
  const T = PACKET[lang] ?? PACKET.en;
  return factLines(model, lang, T.memberTitle);
}

// A signable statement for work the state cannot see (cash, gig, odd jobs). English only.
export function workStatementLines(model) {
  const s = model.workStatement;
  if (!s) return [];
  const T = PACKET.en;
  return [
    T.statementTitle,
    `${T.worker}: ${clean(model.who?.name)}`,
    `${T.employerOrClient}: ${clean(s.employerOrClient)}`,
    `${T.contact}: ${clean(s.contact)}`,
    `${T.datesWorked}: ${clean(s.dates)}`,
    `${T.hoursLabel}: ${clean(s.hours)}`,
    `${T.pay}: ${clean(s.pay)}`,
    T.confirm,
    `${T.workerSignature}: ${SIGN}`,
    `${T.employerSignature}: ${SIGN}`,
  ];
}

// Splits text into lines no wider than maxWidth. A word wider than the width is broken by letter.
export function wrapLines(text, font, size, maxWidth) {
  const width = (s) => font.widthOfTextAtSize(s, size);
  const out = [];
  let line = '';
  const flush = () => { if (line) out.push(line); line = ''; };
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    if (width(word) > maxWidth) {
      flush();
      let chunk = '';
      for (const ch of word) {
        if (chunk && width(chunk + ch) > maxWidth) { out.push(chunk); chunk = ''; }
        chunk += ch;
      }
      line = chunk;
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (width(candidate) > maxWidth) { flush(); line = word; } else line = candidate;
  }
  flush();
  return out.length ? out : [''];
}

// Draws lines from the top of a fresh page, starting new pages as needed. The first line is the title.
function drawTextPages(doc, lines, font, bold) {
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const maxWidth = PAGE.width - 2 * PAGE.margin;
  lines.forEach((text, i) => {
    const isTitle = i === 0;
    const size = isTitle ? PAGE.titleSize : PAGE.size;
    const face = isTitle ? bold : font;
    const leading = isTitle ? PAGE.titleSize + 10 : PAGE.leading;
    for (const piece of wrapLines(safeText(text, face), face, size, maxWidth)) {
      if (y - leading < PAGE.margin) {
        page = doc.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - PAGE.margin;
      }
      page.drawText(piece, { x: PAGE.margin, y: y - size, size, font: face });
      y -= leading;
    }
  });
}

async function attach(doc, attachment, font, PDFDocument) {
  const label = safeText(clean(attachment.label), font);
  if (attachment.kind === 'pdf') {
    const source = await PDFDocument.load(attachment.bytes);
    const pages = await doc.copyPages(source, source.getPageIndices());
    pages.forEach((page, i) => {
      doc.addPage(page);
      if (i === 0 && label) page.drawText(label, { x: PAGE.margin, y: page.getHeight() - PAGE.margin / 2, size: PAGE.labelSize, font });
    });
    return;
  }
  const image = attachment.kind === 'png' ? await doc.embedPng(attachment.bytes) : await doc.embedJpg(attachment.bytes);
  const page = doc.addPage([PAGE.width, PAGE.height]);
  if (label) page.drawText(label, { x: PAGE.margin, y: PAGE.height - PAGE.margin, size: PAGE.labelSize, font });
  const box = { width: PAGE.width - 2 * PAGE.margin, height: PAGE.height - 2 * PAGE.margin - 24 };
  const fit = image.scaleToFit(box.width, box.height);
  page.drawImage(image, { x: (PAGE.width - fit.width) / 2, y: PAGE.margin + (box.height - fit.height) / 2, width: fit.width, height: fit.height });
}

// The whole packet as PDF bytes. Rejects an attachment kind the page did not convert first.
export async function buildPacket(model, PDFDocument, StandardFonts) {
  for (const a of model.attachments ?? []) {
    if (!ATTACHMENT_KINDS.includes(a.kind)) throw new Error(`Cannot attach ${a.kind}`);
  }
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  drawTextPages(doc, coverLines(model), font, bold);
  if ((model.lang ?? 'en') !== 'en') drawTextPages(doc, memberSheetLines(model, model.lang), font, bold);
  const statement = workStatementLines(model);
  if (statement.length) drawTextPages(doc, statement, font, bold);
  for (const a of model.attachments ?? []) await attach(doc, a, font, PDFDocument);
  return doc.save();
}
