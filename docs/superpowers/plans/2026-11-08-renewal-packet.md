# Renewal Packet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second freecare page where a counselor and a Maryland Medicaid member build one dated PDF that proves one month met the new work rule, with the documents behind it, entirely on the device.

**Architecture:** Four pure modules (rules, pay-stub heuristics, cover-sheet and packet text, counselor record) tested in Node, one PDF builder that takes pdf-lib as a parameter the way `fillApplication` does, and one new page `renew.html` wired by `src/renew.js` in the style of `src/app.js`. The bill page is untouched except a five-line read of a `sessionStorage` handoff and a header link.

**Tech Stack:** Browser ES modules, no build step, Node 22 `node --test`, pdf-lib (vendored, ESM), tesseract.js (vendored, reused through `readBillImage`).

**Spec:** `docs/superpowers/specs/2026-11-06-renewal-packet-design.md`

## Global Constraints

- Zero network requests from any page. The only outside URLs are plain links in HTML and in `strings.js`, never fetched.
- Node 22, `npm test` runs `node --test test/*.test.js`. No new dependencies. Only `vendor/pdf-lib` and `vendor/tesseract` may be imported.
- Zero em dashes and zero en dashes in any file.
- No commits without the owner's OK. Every "commit" step in the usual template is replaced here by "run the whole suite"; at the end, give the owner the list of files to commit.
- Every word a page shows lives in `src/strings.js` in English and Spanish; `test/i18n.test.js` checks both pages against it.
- Every `src/*.js` file must appear in the `PRECACHE` list in `sw.js` (enforced by `test/offline.test.js`).
- Copy rule from the spec: the pages never say a person is exempt, compliant, or safe. They say which published test the numbers meet. The sentence "This is my own summary. Maryland Health Connection makes the decision." appears on the cover sheet verbatim.
- Thresholds from the spec: $580 a month from jobs (58000 cents), 80 hours a month of any mix of work, school, job training, volunteering, or school at least half-time. Rules verified 2026-11-06 from https://www.marylandhealthconnection.gov/checkin/. Rule start 2027-01-01.
- Deviation from the spec, decided here: `src/income.js` is not changed. The renewal page asks for gross pay and hours per job for the month directly, which is what a pay stub shows, instead of converting a pay rate.

## Review Focus

1. A pay stub whose pay period straddles two months (period Dec 22 to Jan 4, paid Jan 9). Expected: the reader returns both period dates and the pay date; the month comes from the pay date; the cover sheet prints the period so a caseworker sees the straddle. Pinned in Task 2 (`readStub` keeps all three dates) and Task 4 (`coverLines` prints "paid Jan 9, 2027, for Dec 22, 2026 to Jan 4, 2027").
2. Exact thresholds. $580.00 meets, $579.99 does not; 80.0 hours meets, 79.5 does not. Pinned in Task 1.
3. Nothing met. Expected: the packet still builds and the cover sheet says "Below each threshold for this month" with the numbers beside the thresholds. Pinned in Task 4.
4. A photo in a format pdf-lib cannot embed (HEIC) or a 12 MB photo. Expected: the page converts to JPEG on a canvas scaled to 1600 px before `buildPacket` sees it, and `buildPacket` refuses any attachment kind other than jpeg, png, pdf with a plain error instead of a broken PDF. Pinned in Task 4 (`buildPacket` throws on kind 'heic') and Task 5 (the page's convert step is the only place that calls `createImageBitmap` or a canvas; static test).
5. "Start over for the next person" must leave nothing behind. Expected: every input, the findings list, the attachment list, and the `sessionStorage` handoff key are cleared. Pinned in Task 5 (static test that `renew.js` calls `sessionStorage.removeItem('freecare-handoff')` and `form.reset()` in the start-over handler) and Task 6.

---

### Task 1: Rules and the month test (`src/workrule.js`, `WORKRULE` strings)

**Files:**
- Create: `src/workrule.js`
- Modify: `src/strings.js` (append `export const WORKRULE`)
- Test: `test/workrule.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const RULES = Object.freeze({ earningsFloorCents: 58000, hoursFloor: 80, minAge: 19, maxAge: 64, starts: '2027-01-01', verified: '2026-11-06', source: 'https://www.marylandhealthconnection.gov/checkin/', toolUrl: 'https://www.marylandhealthconnection.gov/checkin/', phone: '1-855-642-8572' })`
  - `export const ACTIVITIES = Object.freeze(['work', 'school', 'training', 'volunteer'])`
  - `export const EXEMPTION_GROUPS = Object.freeze(['general', 'special', 'health', 'hardship', 'local'])`
  - `export const EXEMPTIONS` : frozen array of `{ id, group, proof }` where `proof` is a frozen array of proof-type ids from `PROOF_TYPES`. Ids, in order: `under19`, `over64`, `medicare`, `jailLast90`, `fosterUnder26`, `aian`, `childUnder14`, `caresDisabled`, `veteranDisabled`, `pregnantOrPostpartum`, `tanfWorkRules`, `snapWorkRules`, `inJail`, `physicalDisability`, `mentalHealth`, `substanceUse`, `complexMedical`, `hospitalStay`, `medicalTravel`, `localException`.
  - `export const PROOF_TYPES = Object.freeze(['idWithBirthdate', 'medicareCard', 'releasePapers', 'fosterLetter', 'tribalId', 'childBirthCertificate', 'disabilityLetter', 'dd214', 'doctorLetter', 'benefitsLetter', 'hospitalDischarge', 'travelRecords', 'stateLetter'])`
  - `export function monthOf(iso)` : `'2027-01-09'` to `'2027-01'`; null for anything that is not a valid `YYYY-MM-DD`.
  - `export function previousMonth(todayIso)` : `'2027-02-03'` to `'2027-01'`; `'2027-01-15'` to `'2026-12'`.
  - `export function monthTest({ month, jobs = [], otherHours = {}, halfTimeSchool = false })` returns a frozen `{ month, grossCents, jobHours, hoursTotal, met, metAll, shortfall }` where `jobs` is `[{ employer, grossCents, hours }]`, `otherHours` is `{ school, training, volunteer }` in hours, `grossCents` is the sum of job gross (negatives and non-numbers count as 0), `jobHours` is the sum of job hours, `hoursTotal = jobHours + school + training + volunteer`, `met` is `'earnings'` if `grossCents >= 58000`, else `'school'` if `halfTimeSchool`, else `'hours'` if `hoursTotal >= 80`, else `null`; `metAll` lists every satisfied test in that order; `shortfall` is `{ cents: max(0, 58000 - grossCents), hours: max(0, 80 - hoursTotal) }`.
  - `export function exemptionsById(ids)` : the `EXEMPTIONS` entries for the given ids, in `EXEMPTIONS` order, unknown ids dropped.
  - In `strings.js`: `export const WORKRULE = Object.freeze({ en: {...}, es: {...} })` with keys `exemption[id]` (one sentence each, English copied from the Maryland page, Spanish translated), `group[groupId]` headings, `proof[proofTypeId]` short document names, `activity[activityId]`, `test.earnings`, `test.school`, `test.hours`, `belowAll` ("Below each threshold for this month"), `decides` ("This is my own summary. Maryland Health Connection makes the decision."), `hintsNote` ("What people usually use. Maryland has not published its list and decides for itself.").

- [ ] **Step 1: Write the failing tests**

```js
// test/workrule.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, ACTIVITIES, EXEMPTIONS, EXEMPTION_GROUPS, PROOF_TYPES, monthOf, previousMonth, monthTest, exemptionsById } from '../src/workrule.js';
import { WORKRULE, LANGS } from '../src/strings.js';

test('the thresholds are the ones on the Maryland page, with a verified date', () => {
  assert.equal(RULES.earningsFloorCents, 58000);
  assert.equal(RULES.hoursFloor, 80);
  assert.equal(RULES.starts, '2027-01-01');
  assert.match(RULES.verified, /^2026-11-\d\d$/);
  assert.match(RULES.source, /^https:\/\/www\.marylandhealthconnection\.gov\//);
  assert.deepEqual([...ACTIVITIES], ['work', 'school', 'training', 'volunteer']);
});

test('earnings at exactly $580 meet the test and a cent less does not', () => {
  const met = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 58000, hours: 40 }] });
  assert.equal(met.met, 'earnings');
  assert.deepEqual(met.shortfall, { cents: 0, hours: 40 });
  const short = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 57999, hours: 40 }] });
  assert.equal(short.met, null);
  assert.deepEqual(short.shortfall, { cents: 1, hours: 40 });
});

test('80 hours of any mix meet the test, 79.5 do not, and earnings win when both are met', () => {
  const hours = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 30000, hours: 30 }], otherHours: { school: 20, training: 10, volunteer: 20 } });
  assert.equal(hours.hoursTotal, 80);
  assert.equal(hours.met, 'hours');
  const almost = monthTest({ month: '2027-01', jobs: [], otherHours: { volunteer: 79.5 } });
  assert.equal(almost.met, null);
  assert.equal(almost.shortfall.hours, 0.5);
  const both = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 90000, hours: 90 }] });
  assert.equal(both.met, 'earnings');
  assert.deepEqual(both.metAll, ['earnings', 'hours']);
});

test('half-time school meets the test on its own and sums across jobs are gross', () => {
  const school = monthTest({ month: '2027-01', halfTimeSchool: true });
  assert.equal(school.met, 'school');
  const two = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: 30000, hours: 25 }, { employer: 'B', grossCents: 28000, hours: 20 }] });
  assert.equal(two.grossCents, 58000);
  assert.equal(two.jobHours, 45);
  assert.equal(two.met, 'earnings');
});

test('bad numbers count as zero instead of breaking the arithmetic', () => {
  const r = monthTest({ month: '2027-01', jobs: [{ employer: 'A', grossCents: -5, hours: 'x' }], otherHours: { school: NaN } });
  assert.equal(r.grossCents, 0);
  assert.equal(r.hoursTotal, 0);
  assert.equal(r.met, null);
  assert.ok(Object.isFrozen(r));
});

test('month helpers: pay date to month, and the month before today', () => {
  assert.equal(monthOf('2027-01-09'), '2027-01');
  assert.equal(monthOf('2027-13-01'), null);
  assert.equal(monthOf('nope'), null);
  assert.equal(previousMonth('2027-02-03'), '2027-01');
  assert.equal(previousMonth('2027-01-15'), '2026-12');
});

test('the exemption list is the Maryland list, grouped, each with proof hints and words in both languages', () => {
  assert.equal(EXEMPTIONS.length, 20);
  assert.deepEqual([...EXEMPTION_GROUPS], ['general', 'special', 'health', 'hardship', 'local']);
  for (const e of EXEMPTIONS) {
    assert.ok(EXEMPTION_GROUPS.includes(e.group), e.id);
    assert.ok(e.proof.length >= 1 || e.group === 'local', e.id);
    for (const p of e.proof) assert.ok(PROOF_TYPES.includes(p), `${e.id}: ${p}`);
    for (const lang of LANGS) {
      assert.ok(WORKRULE[lang].exemption[e.id], `${lang} ${e.id}`);
      assert.ok(WORKRULE[lang].group[e.group], `${lang} ${e.group}`);
    }
  }
  assert.deepEqual(exemptionsById(['childUnder14', 'nope', 'medicare']).map((e) => e.id), ['medicare', 'childUnder14']);
  assert.match(WORKRULE.en.exemption.childUnder14, /child under age 14/);
  assert.equal(WORKRULE.en.decides, 'This is my own summary. Maryland Health Connection makes the decision.');
  for (const key of Object.keys(WORKRULE.en.proof)) assert.ok(WORKRULE.es.proof[key], key);
  assert.notEqual(WORKRULE.es.belowAll, WORKRULE.en.belowAll);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/workrule.test.js`
Expected: FAIL, "Cannot find module '../src/workrule.js'".

- [ ] **Step 3: Implement `src/workrule.js`**

Pure functions and frozen data as in the Interfaces block. Numbers go through one helper `num(value)` that returns `0` for anything that is not a finite number at or above zero. `monthOf` validates with the same `Date.UTC` round trip `src/bill.js` uses. `previousMonth` subtracts one month with `Date.UTC(y, m - 2, 1)`.

- [ ] **Step 4: Append `WORKRULE` to `src/strings.js`**

English exemption sentences copied from the spec's rules table (Maryland's wording). Spanish in "usted", plain words, matching the voice of the existing `PAGE.es`. Proof names are short nouns: "a photo ID showing your birthdate", "your Medicare card", "release papers", "a letter from the foster care agency", "a tribal ID or enrollment letter", "the child's birth certificate", "a letter about the disability or care", "DD-214 or VA letter", "a letter from your doctor", "a benefits letter", "hospital discharge papers", "travel or appointment records", "the letter the state sent you".

- [ ] **Step 5: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/workrule.test.js` then `npm test`
Expected: PASS; suite 125 + 7.

---

### Task 2: Pay-stub reader (`src/stub.js`)

**Files:**
- Create: `src/stub.js`
- Test: `test/stub.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (text in, findings out). Reuses the date-parsing approach of `src/bill.js` (copy the private `isoFrom`, `MONTHS`, `labelBefore` helpers into `stub.js`; do not import private functions).
- Produces:
  - `export function findStubDates(text)` : `[{ iso, label, source }]` with `label` in `'pay' | 'start' | 'end' | 'period' | null`. Labels: pay `/\b(pay date|check date|date paid|paid on|advice date|payment date)\b/i`; start `/\b(period (start|begin(ning)?)|start(ing)?|from|beginning)\b/i`; end `/\b(period end(ing)?|end(ing)?|through|thru|to)\b/i`; period `/\bpay period\b/i`. When one line has two dates and a `pay period` label, the first is `start` and the second is `end`.
  - `export function findHours(text)` : `[{ hours, label, source }]` for numbers followed or preceded on the same line by `hours`, `hrs`, `hr` or a line labeled `regular`, `reg`, `overtime`, `ot`, `total hours`; `label` in `'regular' | 'overtime' | 'total' | null`; only values with `0 < hours <= 400`.
  - `export function findGross(text)` : `[{ cents, label, source }]` for dollar amounts, `label` in `'gross' | 'net' | 'ytd' | null`; gross `/\b(gross( pay| earnings)?|total earnings|earnings)\b/i`; net `/\b(net( pay)?|take home)\b/i`; ytd `/\b(ytd|year[- ]to[- ]date)\b/i` wins over gross when both appear before the amount.
  - `export function findEmployer(text)` : the first line containing a company word (`inc`, `llc`, `corp`, `corporation`, `company`, `co.`, `ltd`, `group`, `services`, `health`, `hospital`, `restaurant`, `diner`, `market`, `store`, `school`, `university`, `county`, `city of`) as a word, trimmed; `null` if no line has one. No other fallback: a receipt with no company word gives no employer rather than a guess.
  - `export function readStub(text)` : frozen `{ employer, payDate, periodStart, periodEnd, hours, grossCents }`; each is `{ value, source }` or `null`. Picks: `payDate` = first `pay`-labeled date, else the latest date; `periodStart`/`periodEnd` = `start`/`end` labels, else the two earliest dates in order when at least two exist and are not the pay date; `hours` = `total`, else `regular`, else the largest unlabeled; `grossCents` = first `gross` current amount, else the largest positive amount that is not `ytd` or `net`.

- [ ] **Step 1: Write the failing tests**

```js
// test/stub.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStubDates, findHours, findGross, findEmployer, readStub } from '../src/stub.js';

const STUB_A = `Blue Crab Diner LLC
Employee: Dana Example
Pay Period: 12/22/2026 - 01/04/2027   Pay Date: 01/09/2027
Earnings      Rate    Hours    Current     YTD
Regular       15.50   74.00    1,147.00    1,147.00
Overtime      23.25    6.00      139.50      139.50
Gross Pay                       $1,286.50  $1,286.50
Federal Tax                       -98.20
Net Pay                         $1,061.12`;

const STUB_B = `ACME HOME HEALTH SERVICES
Statement of Earnings
Period Start 01/01/2027  Period End 01/15/2027
Check Date Jan 20, 2027
Hours Worked 42.5
Total Earnings $637.50
Year to Date $637.50`;

const STUB_C = `Cash receipt
Lawn work for Mr. Reyes
Paid $240 on 1/16/2027`;

test('a two-week stub: period dates, pay date, hours by label, gross not net or ytd', () => {
  const dates = findStubDates(STUB_A);
  assert.deepEqual(dates.map((d) => [d.iso, d.label]), [['2026-12-22', 'start'], ['2027-01-04', 'end'], ['2027-01-09', 'pay']]);
  const hours = findHours(STUB_A);
  assert.deepEqual(hours.map((h) => [h.hours, h.label]), [[74, 'regular'], [6, 'overtime']]);
  const gross = findGross(STUB_A);
  assert.ok(gross.some((g) => g.cents === 128650 && g.label === 'gross'));
  assert.ok(gross.some((g) => g.cents === 106112 && g.label === 'net'));
  assert.equal(findEmployer(STUB_A), 'Blue Crab Diner LLC');
  const read = readStub(STUB_A);
  assert.equal(read.employer.value, 'Blue Crab Diner LLC');
  assert.equal(read.payDate.value, '2027-01-09');
  assert.equal(read.periodStart.value, '2026-12-22');
  assert.equal(read.periodEnd.value, '2027-01-04');
  assert.equal(read.hours.value, 80, 'regular plus overtime when there is no total line');
  assert.equal(read.grossCents.value, 128650);
  assert.match(read.grossCents.source, /Gross Pay/);
});

test('a stub with written labels and a month-name check date', () => {
  const read = readStub(STUB_B);
  assert.equal(read.employer.value, 'ACME HOME HEALTH SERVICES');
  assert.equal(read.payDate.value, '2027-01-20');
  assert.equal(read.periodStart.value, '2027-01-01');
  assert.equal(read.periodEnd.value, '2027-01-15');
  assert.equal(read.hours.value, 42.5);
  assert.equal(read.grossCents.value, 63750, 'Total Earnings is gross; Year to Date is skipped');
});

test('a cash receipt gives an amount and a date and nothing else, never a guess', () => {
  const read = readStub(STUB_C);
  assert.equal(read.grossCents.value, 24000);
  assert.equal(read.payDate.value, '2027-01-16');
  assert.equal(read.hours, null);
  assert.equal(read.periodStart, null);
  assert.equal(read.periodEnd, null);
  assert.equal(read.employer, null, 'no company word on any line');
});

test('empty or garbage text reads as all nulls', () => {
  for (const text of ['', null, 'asdf 123 !!!']) {
    const read = readStub(text);
    for (const key of ['employer', 'payDate', 'periodStart', 'periodEnd', 'hours', 'grossCents']) assert.equal(read[key], null, `${JSON.stringify(text)} ${key}`);
    assert.ok(Object.isFrozen(read));
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/stub.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/stub.js`**

Follow `src/bill.js` line by line in shape: line-by-line scanning, `labelBefore` with label tables, pickers at the bottom. For `findHours`, a number is a candidate when the same line matches `/\b(hours?|hrs?|regular|reg|overtime|ot)\b/i`; take numeric tokens `/\b\d{1,3}(?:\.\d{1,2})?\b/g` that are not part of a dollar amount, a date, or a rate column: when a line has three or more numbers (rate, hours, current), the hours figure is the one labeled by a header line containing `Hours` at the same column position; simpler and acceptable for v2: take the second number on a `Regular`/`Overtime` row and the first number on a line that contains the word `hours`. Sum `regular` and `overtime` in `readStub` when no `total` exists.

- [ ] **Step 4: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/stub.test.js` then `npm test`
Expected: PASS.

---

### Task 3: The counselor's record (`src/record.js`)

**Files:**
- Create: `src/record.js`
- Modify: `src/strings.js` (append `export const RECORD`)
- Test: `test/record.test.js`

**Interfaces:**
- Consumes: `RULES`, `monthTest` result shape, `exemptionsById` from Task 1; `WORKRULE[lang]` from `strings.js`.
- Produces:
  - `export const RECORD_FILE = 'medicaid-proof-record.txt'`
  - `export function counselorRecord({ model, nowIso, lang = 'en' })` returns plain text. `model` is the packet model used everywhere after this task: `{ who: { name, caseNumber }, month, jobs: [{ employer, grossCents, hours, payDate, periodStart, periodEnd }], otherHours: { school, training, volunteer }, halfTimeSchool, exemptions: [ids], attachments: [{ label, kind }], test: <monthTest result>, workStatement: null | { employerOrClient, contact, dates, hours, pay } }`. `nowIso` is a full ISO timestamp like `'2027-01-12T15:04:00-05:00'`. Lines, in order: title; the timestamp; "Rules last checked RULES.verified, RULES.source"; the month; one line per job (employer, gross in dollars, hours, pay date and period when present); the other hours; the school flag; which test the numbers meet or `WORKRULE[lang].belowAll`; the exemptions listed by their sentence; the attachments by label and kind; the decides sentence; a last line "Made with freecare (the page runs on this device; nothing was sent anywhere)". Lines with nothing behind them are left out, as in `coverLetter`.
  - `export const RECORD` in strings: `{ en: { title, when, rulesChecked, month, job, otherHours, halfTime, meets, exemptions, attachments, footer, locale }, es: {...} }`, functions where a value is interpolated, the same style as `LETTER`.

- [ ] **Step 1: Write the failing tests**

```js
// test/record.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counselorRecord, RECORD_FILE } from '../src/record.js';
import { monthTest } from '../src/workrule.js';

const jobs = [{ employer: 'Blue Crab Diner LLC', grossCents: 128650, hours: 80, payDate: '2027-01-09', periodStart: '2026-12-22', periodEnd: '2027-01-04' }];
const model = {
  who: { name: 'Dana Example', caseNumber: 'MHC-123' },
  month: '2027-01',
  jobs,
  otherHours: { school: 0, training: 0, volunteer: 0 },
  halfTimeSchool: false,
  exemptions: ['childUnder14'],
  attachments: [{ label: 'Pay stub Jan 9', kind: 'jpeg' }],
  test: monthTest({ month: '2027-01', jobs }),
  workStatement: null,
};

test('the record says when, which rules, what was entered, what the page said, and who decides', () => {
  const text = counselorRecord({ model, nowIso: '2027-01-12T15:04:00-05:00', lang: 'en' });
  assert.match(text, /January 12, 2027/);
  assert.match(text, /Rules last checked 2026-11-\d\d/);
  assert.match(text, /marylandhealthconnection\.gov/);
  assert.match(text, /January 2027/);
  assert.match(text, /Blue Crab Diner LLC: \$1,286\.50 gross, 80 hours, paid January 9, 2027 for December 22, 2026 to January 4, 2027/);
  assert.match(text, /Meets: at least \$580 from a job \(\$1,286\.50\)/);
  assert.match(text, /child under age 14/);
  assert.match(text, /Pay stub Jan 9 \(jpeg\)/);
  assert.match(text, /This is my own summary\. Maryland Health Connection makes the decision\./);
  assert.match(text, /nothing was sent anywhere/);
  assert.doesNotMatch(text, /undefined|null|NaN|\u2014/);
  assert.equal(RECORD_FILE, 'medicaid-proof-record.txt');
});

test('nothing met prints the below-threshold line and leaves empty sections out; Spanish says the same things', () => {
  const none = { ...model, jobs: [], exemptions: [], attachments: [], test: monthTest({ month: '2027-01', jobs: [], otherHours: { volunteer: 10 } }) };
  const text = counselorRecord({ model: none, nowIso: '2027-01-12T15:04:00-05:00', lang: 'en' });
  assert.match(text, /Below each threshold for this month/);
  assert.match(text, /10 hours/);
  assert.doesNotMatch(text, /Attachments/);
  const es = counselorRecord({ model, nowIso: '2027-01-12T15:04:00-05:00', lang: 'es' });
  assert.match(es, /12 de enero de 2027/);
  assert.match(es, /Maryland Health Connection/);
  assert.doesNotMatch(es, /\u2014/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/record.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/record.js` and append `RECORD` to `src/strings.js`**

Dates through `Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })` on `${iso}T00:00:00Z` for day dates and `{ year: 'numeric', month: 'long' }` for the month, as `letter.js` does. Money through `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` in both languages.

- [ ] **Step 4: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/record.test.js` then `npm test`
Expected: PASS.

---

### Task 4: The packet (`src/packet.js`)

**Files:**
- Create: `src/packet.js`
- Modify: `src/strings.js` (append `export const PACKET`)
- Test: `test/packet.test.js`

**Interfaces:**
- Consumes: the model from Task 3; `RULES`, `WORKRULE` from Task 1.
- Produces:
  - `export const PACKET_FILE = 'medicaid-proof-packet.pdf'`
  - `export const MAX_IMAGE_EDGE = 1600` and `export const ATTACHMENT_KINDS = Object.freeze(['jpeg', 'png', 'pdf'])`
  - `export function coverLines(model)` : English string array for page one, in order: `Proof of work for Medicaid, <Month Year>`; `Name: <name>`; `Case or notice number: <n>` (only if given); `Earned from jobs this month: $X (the test is at least $580)`; one line per job `<employer>: $X gross, N hours, paid <date> for <start> to <end>` (date parts only when present); `Hours this month: N (the test is 80 hours of work, school, job training or volunteering)` followed by the breakdown `work N, school N, job training N, volunteering N` dropping zeros; `School at least half-time: yes` only when true; `Meets: <test sentence>` or `Below each threshold for this month`; `Exemption claimed: <sentence>` per exemption; `Documents attached: N` then `1. <label>` lines; `Date: <today>`; `WORKRULE.en.decides`; `Signature: ______________________`.
  - `export function memberSheetLines(model, lang)` : the same facts as `coverLines` in `lang`, titled `What is in this packet` (Spanish when `lang === 'es'`); used only when `lang !== 'en'`.
  - `export function workStatementLines(model)` : English lines for the signable statement when `model.workStatement` is set: title `Statement of work`; `Worker: <name>`; `Employer or client: <employerOrClient>`; `Contact: <contact>`; `Dates worked: <dates>`; `Hours: <hours>`; `Pay: <pay>`; the sentence `I confirm that the above is true to the best of my knowledge.`; two signature lines `Worker signature and date` and `Employer or client signature and date`.
  - `export function wrapLines(text, font, size, maxWidth)` : splits one string into lines no wider than `maxWidth` using `font.widthOfTextAtSize`; words longer than the width are broken.
  - `export async function buildPacket(model, PDFDocument, StandardFonts)` : returns `Uint8Array`. Letter pages (612 x 792). Page one: `coverLines` at Helvetica 11, 54 pt margins, 16 pt leading, title at 18. Then, if `model.lang === 'es'`, a member sheet page. Then, if `model.workStatement`, the statement page. Then one page per attachment: label at the top in Helvetica 10, the image scaled to fit inside the margins and centered; a `pdf` attachment's pages are copied with `copyPages` and the label drawn on the first copied page. Throws `new Error(\`Cannot attach ${kind}\`)` for a kind outside `ATTACHMENT_KINDS`.
  - `PACKET` strings: `{ en: { title: (month) => ..., name, caseNumber, earned: (amount) => ..., hours: (n) => ..., breakdown labels, halfTime, meets, below, exemption, attached: (n) => ..., date, signature, memberTitle, statementTitle, worker, employerOrClient, contact, datesWorked, hoursLabel, pay, confirm, workerSignature, employerSignature, locale }, es: {...} }`.

- [ ] **Step 1: Write the failing tests**

```js
// test/packet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { coverLines, memberSheetLines, workStatementLines, wrapLines, buildPacket, PACKET_FILE, MAX_IMAGE_EDGE, ATTACHMENT_KINDS } from '../src/packet.js';
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
  const pdfAttachment = { label: 'School letter', kind: 'pdf', bytes: await (await PDFDocument.create()).save() };
  const withPdf = await buildPacket({ ...model, attachments: [pdfAttachment] }, PDFDocument, StandardFonts);
  assert.equal((await PDFDocument.load(withPdf)).getPageCount(), 1, 'an empty PDF adds no pages');
  await assert.rejects(() => buildPacket({ ...model, attachments: [{ label: 'x', kind: 'heic', bytes: PNG }] }, PDFDocument, StandardFonts), /Cannot attach heic/);
  assert.equal(PACKET_FILE, 'medicaid-proof-packet.pdf');
  assert.equal(MAX_IMAGE_EDGE, 1600);
  assert.deepEqual([...ATTACHMENT_KINDS], ['jpeg', 'png', 'pdf']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/packet.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/packet.js` and append `PACKET` to `src/strings.js`**

Text pages: one helper `drawLines(page, lines, font, { size, leading, margin, titleSize })` that wraps each line with `wrapLines`, draws from the top, and starts a new page when `y < margin` (return the last page). Images: `doc.embedPng` or `doc.embedJpg`, then `image.scaleToFit(width - 2 * margin, height - 2 * margin - 24)` and `page.drawImage` centered under the label. PDFs: `const src = await PDFDocument.load(bytes); const pages = await doc.copyPages(src, src.getPageIndices()); pages.forEach((p) => doc.addPage(p))`, label drawn on the first copied page if any.

- [ ] **Step 4: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/packet.test.js` then `npm test`
Expected: PASS.

---

### Task 5: The page (`renew.html`, `src/renew.js`, strings, offline list)

**Files:**
- Create: `renew.html`, `src/renew.js`
- Modify: `src/strings.js` (add `renew.*` keys to `PAGE.en` and `PAGE.es`; add `UI` keys listed below), `sw.js` (bump `CACHE` to `'freecare-3'`, add `renew.html`, `src/renew.js`, `src/workrule.js`, `src/stub.js`, `src/packet.js`, `src/record.js` to `PRECACHE`)
- Modify: `test/i18n.test.js` (check both HTML files), `test/offline.test.js` (require `renew.html` in the list)
- Test: `test/renew-page.test.js`

**Interfaces:**
- Consumes: `RULES`, `EXEMPTIONS`, `EXEMPTION_GROUPS`, `monthTest`, `previousMonth`, `monthOf`, `exemptionsById` (Task 1); `readStub` (Task 2); `counselorRecord`, `RECORD_FILE` (Task 3); `buildPacket`, `PACKET_FILE`, `MAX_IMAGE_EDGE`, `ATTACHMENT_KINDS` (Task 4); `readBillImage` from `src/ocr.js`; `applyLanguage`, `pickLanguage`, `textFor` from `src/i18n.js`; `todayIso` from `src/dates.js`; `WORKRULE`, `UI`, `PAGE` from `src/strings.js`.
- Produces: the page. `sessionStorage` key `'freecare-handoff'` with JSON `{ householdSize, income }` written by the "Check the hospital bill with these numbers" button before it navigates to `index.html` (Task 6 reads it).

Page structure (ids are what `renew.js` and the tests use):
- `header.intro`: `#lang-toggle`, `h1[data-i18n="renew.title"]`, `p[data-i18n="renew.lede"]`, `p[data-i18n="renew.privacy"]`, `a[href="index.html"][data-i18n="renew.toBill"]`.
- `section#state-tool`: `p[data-i18n="renew.stateTool"]` with `a#state-tool-link[href=RULES.toolUrl]` and the phone from `RULES.phone` set by `renew.js`.
- `form#renew-form` (novalidate):
  - `#memberName`, `#caseNumber`, `#month` (`type="month"`, default `previousMonth(todayIso())`).
  - `#jobs` container of job rows (`.job` with inputs `.job__employer`, `.job__gross`, `.job__hours`, `.job__payDate` type date, `.job__periodStart`, `.job__periodEnd`), `#add-job` button.
  - `#stubPhoto` file input (`accept="image/*,application/pdf"`, `capture="environment"`), `#stub-status`, `ul#stub-findings` (reuse the finding pattern from `app.js`: each finding is a button "Use this" that fills the current job row).
  - `#schoolHours`, `#trainingHours`, `#volunteerHours`, `#halfTimeSchool` checkbox.
  - `fieldset#exemptions` built by `renew.js` from `EXEMPTIONS` grouped by `EXEMPTION_GROUPS`, each a checkbox `name="exemption" value="<id>"` with its sentence and a `small` proof hint; a `p[data-i18n="renew.hintsNote"]`.
  - `#attachments` list and `#attachmentFiles` file input (`multiple`, `accept="image/*,application/pdf"`), each row with a text input for the label (default: file name) and a remove button.
  - `details#work-statement` with `#wsEmployer`, `#wsContact`, `#wsDates`, `#wsHours`, `#wsPay`; filled means `workStatement` is set.
  - `section#summary` (aria-live): `#summary-earned`, `#summary-hours`, `#summary-meets`, rendered on every input.
  - Buttons: `#build-button` (submit), `#record-button`, `#start-over`, plus `p#renew-error[role=alert]`.
- `section#handoff`: `#householdSize`, `#income` (prefilled with the proven month gross times twelve, editable), `#to-bill` button.
- Footer as `index.html`, same text keys, plus `a[href="index.html"]`.

`renew.js` behavior: `readModel()` builds the model from the form (cents from dollars with the same `toNumber` approach as `income.js`); `renderSummary()` runs `monthTest` and writes the three summary lines using `WORKRULE[lang]`; the stub photo flow mirrors `app.js` lines 393 to 450 but calls `readStub`; attachments are converted in `prepareAttachment(file)`: PDFs pass through as `kind: 'pdf'`; images go through `createImageBitmap` and a canvas scaled so the long edge is at most `MAX_IMAGE_EDGE`, exported as JPEG quality 0.85, `kind: 'jpeg'`; on failure the row shows `UI[lang].attachFailed`. `#build-button` imports pdf-lib the way `app.js` line 505 does and downloads `PACKET_FILE`; `#record-button` opens `counselorRecord` text for printing the way `openText` does in `app.js`; `#start-over` runs `form.reset()`, empties jobs to one blank row, clears findings, attachments, summary, and `sessionStorage.removeItem('freecare-handoff')`; `#to-bill` writes the handoff and sets `location.href = 'index.html'`. Language toggle and `localStorage` key `'freecare-lang'` exactly as `app.js`.

New `UI` keys (both languages): `attachFailed`, `addJob`, `removeJob`, `jobN: (n) => ...`, `foundEmployer`, `foundPayDate`, `foundPeriod`, `foundHours`, `foundGross`, `stubNothing`, `summaryEarned: (amount) => ...`, `summaryHours: (n) => ...`, `summaryMeets: (sentence) => ...`, `buildFailed`.

- [ ] **Step 1: Write the failing tests**

```js
// test/renew-page.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../renew.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../src/renew.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('the renewal page has the controls the script expects, and loads only its own files', () => {
  for (const id of ['lang-toggle', 'renew-form', 'memberName', 'caseNumber', 'month', 'jobs', 'add-job', 'stubPhoto', 'stub-findings', 'schoolHours', 'trainingHours', 'volunteerHours', 'halfTimeSchool', 'exemptions', 'attachments', 'attachmentFiles', 'work-statement', 'summary', 'build-button', 'record-button', 'start-over', 'handoff', 'householdSize', 'income', 'to-bill', 'renew-error', 'state-tool-link']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<script type="module" src="src\/renew\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="src\/styles\.css">/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
  assert.match(html, /href="index\.html"/);
  assert.match(html, /<input id="month" name="month" type="month"/);
  assert.match(html, /<input id="attachmentFiles"[^>]*multiple/);
});

test('the script never fetches anything but its own files, converts photos itself, and start-over clears the handoff', () => {
  assert.doesNotMatch(js, /fetch\(\s*['"`]https?:/);
  assert.doesNotMatch(js, /https?:\/\//, 'outside addresses live in strings.js and workrule.js, not here');
  assert.match(js, /createImageBitmap|new Image\(/);
  assert.match(js, /MAX_IMAGE_EDGE/);
  assert.match(js, /toBlob\([^)]*image\/jpeg/);
  assert.match(js, /sessionStorage\.removeItem\('freecare-handoff'\)/);
  assert.match(js, /sessionStorage\.setItem\('freecare-handoff'/);
  assert.match(js, /\.reset\(\)/);
  assert.match(js, /import\('\.\.\/vendor\/pdf-lib\/pdf-lib\.esm\.min\.js'\)/);
  assert.match(js, /readBillImage\(/);
  assert.match(js, /readStub\(/);
  assert.match(js, /buildPacket\(/);
  assert.match(js, /counselorRecord\(/);
  assert.match(js, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
});

test('the worker caches the renewal page and its modules under a new cache name', () => {
  assert.match(sw, /const CACHE = 'freecare-3'/);
  for (const file of ['renew.html', 'src/renew.js', 'src/workrule.js', 'src/stub.js', 'src/packet.js', 'src/record.js']) assert.match(sw, new RegExp(`'${file.replace('.', '\\.')}'`), file);
});

test('the page never claims to decide, and names the state tool and the phone line', () => {
  assert.doesNotMatch(html, /you are exempt|you qualify|you are safe|you comply/i);
  assert.match(html, /Maryland Health Connection makes the decision/);
  assert.doesNotMatch(html, /\u2014|\u2013/);
});
```

Also modify `test/i18n.test.js`: replace the single `html` read with `const pages = ['index.html', 'renew.html'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))` and run the first two tests over every page (the `keysInHtml.length >= 30` check applies to the sum). Modify `test/offline.test.js`: add `'renew.html'` to the `must` list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/renew-page.test.js test/i18n.test.js test/offline.test.js`
Expected: FAIL, `renew.html` missing.

- [ ] **Step 3: Write `renew.html`**

Copy the head, header, footer and `noscript` of `index.html`; change the title key to `renew.title`; sections as listed. Every visible string has `data-i18n`, with the English text in the markup matching `PAGE.en` exactly (the parity test enforces this). Reuse existing CSS classes (`intro`, `check`, `field`, `hint`, `error`, `findings`, `check__button`, `check__button--quiet`, `result`); add at most a `.jobs`, `.job`, `.attachments`, `.summary` block to `src/styles.css` in the same visual system (serif, Maryland gold rules, square buttons) and keep `test/styles.test.js` green.

- [ ] **Step 4: Write `src/renew.js`, add strings, update `sw.js`**

As described in Interfaces. Default the month input to `previousMonth(todayIso())`. Add one blank job row on load. Render exemptions from `EXEMPTIONS` so the HTML has no exemption text to keep in sync; the fieldset legend and group headings come from `WORKRULE[lang].group`.

- [ ] **Step 5: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/renew-page.test.js test/i18n.test.js test/offline.test.js` then `npm test`
Expected: PASS.

- [ ] **Step 6: Open it in the browser preview and walk through one case**

Run: `python3 -m http.server 8780` in the repo folder (through the preview tool), open `http://localhost:8780/renew.html` at phone width. Enter Dana's job (gross 1286.50, hours 80, paid 2027-01-09), add the 1x1 PNG from the test as an attachment, build the packet, open the PDF, print the record, start over. Expected: summary says Meets at least $580; the PDF has 2 pages; after start over every field is blank and `sessionStorage` has no `freecare-handoff`. Check the console for errors and the network panel for zero outside requests.

---

### Task 6: Handoff into the bill page and the link between pages

**Files:**
- Modify: `src/app.js` (read the handoff on load, about five lines near the top-level `form` setup), `index.html` (one link in `header.intro` to `renew.html`), `src/strings.js` (`PAGE.*['renew.link']`)
- Test: extend `test/page.test.js`

**Interfaces:**
- Consumes: `sessionStorage['freecare-handoff']` JSON `{ householdSize, income }` written by Task 5.
- Produces: on load, if the key exists, `form.elements.householdSize.value` and `form.elements.income.value` are filled, the key is removed, and the pay helper and bill render as if typed (call the existing `renderBill()` and the `input` handlers once).

- [ ] **Step 1: Write the failing test**

```js
// append to test/page.test.js
test('the bill page accepts the renewal handoff once and links to the renewal page', () => {
  assert.match(app, /sessionStorage\.getItem\('freecare-handoff'\)/);
  assert.match(app, /sessionStorage\.removeItem\('freecare-handoff'\)/);
  assert.match(html, /<a href="renew\.html" data-i18n="renew\.link">/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/page.test.js`
Expected: FAIL on the three new assertions.

- [ ] **Step 3: Implement**

In `src/app.js`, after the element lookups: a `readHandoff()` that wraps the `sessionStorage` read in `try` (private windows throw), parses JSON, fills the two inputs when the values are positive numbers, removes the key, and calls `renderBill()`. In `index.html`, add `<p class="intro__privacy"><a href="renew.html" data-i18n="renew.link">Got a Medicaid work-rule letter? Build your proof packet</a></p>` under the privacy line; add `renew.link` to `PAGE.en` and `PAGE.es`.

- [ ] **Step 4: Run the tests to verify they pass, then the whole suite**

Run: `node --test test/page.test.js test/i18n.test.js` then `npm test`
Expected: PASS.

---

### Task 7: Finish: whole suite, browser check at phone width, README, wiki

**Files:**
- Modify: `README.md` (a short "Medicaid proof packet" section: what it does, the rules table with the verified date, the files, the test count), `CLAUDE.md` (one line: "renew.html is the proof-packet page; rules in src/workrule.js, re-verify against the Maryland page each build")
- Modify: `/Users/kadigari/Documents/Kadigari/wiki/projects/freecare.md` (a dated status row), `/Users/kadigari/Documents/Kadigari/wiki/log.md` (entry on top)

- [ ] **Step 1: Run the whole suite and count**

Run: `npm test`
Expected: PASS, 0 fail; note the new total.

- [ ] **Step 2: Browser pass on both pages**

Through the preview tool at phone width and desktop width, light and dark: `index.html` still works end to end (check, apply, letter); `renew.html` end to end with a real photo of a drawn pay stub (draw one on paper, photograph it, or render the `STUB_A` text to an image) and one PDF attachment; the handoff lands on the bill page with household size and income filled. Screenshots to `docs/screenshots/renew-*.jpg`. Zero outside requests in the network panel on both pages.

- [ ] **Step 3: Grep for em dashes and leftovers**

Run: `grep -rn $'\u2014\|\u2013' --include='*.js' --include='*.html' --include='*.md' . | grep -v node_modules | grep -v vendor`
Expected: no output.

- [ ] **Step 4: README, CLAUDE.md, wiki**

Write the sections above. In the wiki status row name the test total and that the repo is uncommitted pending the owner.

- [ ] **Step 5: Hand the owner the commit list**

List every created and modified file and a suggested message (`feat: Medicaid proof packet page`), and stop. Commit only when he says so.
