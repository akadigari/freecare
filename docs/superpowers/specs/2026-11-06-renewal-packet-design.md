# freecare v2: the proof packet for Maryland's Medicaid work rule

Status: draft for the owner's approval, written 2026-11-06. Nothing is built until he says yes.
Every line marked (my call) was decided by Claude without the owner's answer and is his to overturn. The short list at the bottom, "Check these", is what he should read first.

## Why

Starting January 1, 2027, Maryland Medicaid adults ages 19 to 64 (up to 320,000 members) must show that they work or do approved activities, and must renew twice a year. Maryland Health Connection says it will first check "using data we already have." If that is not enough, the member gets a letter or email asking for proof, and at 2027 renewals the member must show the rule was met for at least one month.

The people who will get that letter are the people whose work the state cannot see: cash jobs, gig work, several part-time jobs, self-employment, volunteering, school, caregiving, a health condition. These are the same households freecare already helps with hospital bills, and freecare already has most of the parts: a pay helper, an on-device document reader, a PDF builder, a cover letter, Spanish, and offline mode.

The goal of v2: when the "we need more proof" letter arrives, a member, or the counselor sitting with them, can build one dated proof packet in one sitting on one device. The packet is a cover sheet that says which rule is met and shows the arithmetic, followed by the documents behind it. The same income numbers then feed freecare's hospital financial assistance check and application.

## What changed after reading Maryland's own page (2026-11-06)

The October 27 idea included an exemption screener and a "do the rules apply to me" check. Maryland Health Connection already has both: an online tool, a virtual assistant named Flora, and a full published exemption list. So v2 does not rebuild the screener. It links to the state's tool and starts where the state stops, which is assembling proof.

Two more facts shape the design. Only one qualifying month has to be shown at 2027 renewals, so the packet is built around picking and proving one month. And the state has not yet published what its proof letter asks for or how proof is sent, so the cover sheet stays plain and general until a real letter is in hand.

## Who uses it

(my call) The main user is a counselor or assister at a clinic, hospital financial office, or community group, at a desk with the member beside them. A member alone on a phone must still be able to finish. Reasons: the October 26 focus groups said the people who control access want a record of what was shown and a named person responsible, and the planned test is with two assister organizations.

## Goals

1. Pick and prove one month. Enter pay for a month from one or more jobs, by hand or from a photo of a pay stub. Show monthly earnings and hours, and say plainly which test is met: at least $580 from a job, school at least half-time, or 80 hours from any mix of paid work, school, job training, and volunteering.
2. Exemption proof. If the member says an exemption on Maryland's list applies, show what kind of document usually proves it and let them add that document to the packet. The page never says whether an exemption is granted.
3. Read pay stubs on the device. A photo of a pay stub gives candidates for employer, pay period dates, hours, and gross pay, each with a "Use this" button, the same pattern as the bill reader. Other documents (a school letter, a volunteer letter, a doctor's note) are attached as pictures with a typed label and are not read.
4. Build the packet. One PDF. Page one is the cover sheet: member name, the month covered, which rule is met and the arithmetic, a list of the attached documents, today's date, the notice or case number if the member types one, the sentence "This is my own summary. Maryland Health Connection makes the decision.", and a signature line that the page never fills. Then each document, one per page, with its label. The cover sheet is in English or Spanish; documents stay as they are.
5. A record for the counselor. A one-page record of what was entered and what the page said, with the date and time, the date the rules were last checked, and the source links. A "Start over for the next person" button wipes everything.
6. Reuse. Household size and yearly income carry into the existing hospital check and application, so a counselor can do both in one sitting.
7. Stay private. Zero network requests. Nothing is kept after the tab closes unless the member downloads the packet.

## Not in v2

- No sending to the state. The member uploads or mails the packet the way their notice says.
- No account, server, or database. No payroll connectors (Argyle, Pinwheel, Truework), which need a server and keys.
- (my call) No AI model call. Reading is on-device text recognition plus rules. See "Check these".
- No other states. No SNAP or TANF work rules. No filling of the six-month renewal itself, which happens inside the member's Maryland Health Connection account.
- No decision engine for "do the rules apply to me" beyond a short pointer to Maryland's tool and its exemption list.

## What would make it a failure even if it works

- Telling someone they are exempt, compliant, or safe. The page only sets what they entered beside the published thresholds.
- Sending member data off the device, or a privacy sentence that is not literally true.
- Looking like an official state form, or using the state's name as if the state made it.
- A cover sheet a caseworker cannot read in thirty seconds.

## The rules it uses

Source: Maryland Health Connection, "Medicaid Check-In", https://www.marylandhealthconnection.gov/checkin/, read 2026-11-06. Federal basis: Public Law 119-21 (the six-month renewal is section 71107) and the CMS interim final rule CMS-2454-IFC, 91 FR 33348, June 3, 2026. The builder re-reads the live Maryland page on build day and records a "last verified" date in the rules module, the way `src/policies.js` does for hospital policies.

| Item | What Maryland says |
|---|---|
| Who | Adults 19 to 64 who earn up to $21,000 a year for one person, or up to $44,000 for a family of four |
| Start | January 1, 2027. "When you renew your Medicaid in 2027, you must show that you met the work requirement for at least one month." |
| How the state checks | First "using data we already have". If more proof is needed, a letter or email that "will explain what information to send us and how to send it" |
| Ways to meet it each month | Earn at least $580 a month from a job. Go to school at least half-time. Complete 80 hours a month of any mix of paid work, school, job training, volunteering |
| General exceptions | Under 19. 65 or older. Medicare Part A or B. In jail or prison in the past 90 days |
| Special exceptions | Under 26 and was in foster care. American Indian or Alaska Native. Cares for a child under 14. Cares for a person with a disability. Veteran with a disability. Pregnant or gave birth in the past 12 months. Gets TANF and follows its work rules. Subject to SNAP work rules. Currently in jail or prison |
| Health conditions | A condition that limits work, such as blindness or a physical disability, a mental health condition, a substance use disorder or being in treatment, a complex medical condition |
| Short-term hardship, since the last renewal | An overnight stay in a hospital, nursing home, or care center. Travel outside the area for medical care for the member or a family member |
| Local exceptions | High unemployment or a declared emergency. The state sends a letter |

Not on Maryland's page, so not in v2 unless it appears by build day: averaging income over six months for seasonal workers, which the federal law allows.

## How it is made

The parts below are decided. Each is (my call) unless the repo already fixes it.

- Same repo and the same rules as today: browser only, zero network requests, Node 22 tests with `npm test`, test-first, no new libraries beyond the two already vendored (pdf-lib and tesseract.js), zero em dashes, no commits without the owner's OK.
- A second page, `renew.html`, that shares modules with the bill page and links to it and back. The bill flow, its page weight, and its 125 tests stay untouched. The offline file list in `sw.js` gains the new files.
- Suggested modules. The builder may rename them.
  - `src/workrule.js`: pure functions. The thresholds, a month test (earnings from jobs, hours by activity, a half-time school flag) that returns which test is met and the arithmetic, the exemption list with a proof hint for each, the "last verified" date and source links.
  - `src/stub.js`: pure text heuristics for pay stubs (employer, pay period start and end, hours, gross pay), in the style of `src/bill.js`.
  - `src/packet.js`: builds the PDF from a plain packet object with pdf-lib passed in, the way `fillApplication` in `src/apply.js` takes `PDFDocument`.
  - `src/record.js`: the counselor's record as plain text, in the style of `src/letter.js`.
  - All words in `src/strings.js` in both languages, with the existing parity test extended.
- Reuse: the pay helper in `src/income.js` gains a monthly figure beside `yearlyIncome`. The reader in `src/ocr.js` is reused for pay stub photos.
- Pictures in the PDF: pdf-lib takes JPEG and PNG. Phone photos in other formats are drawn to a canvas and saved as JPEG first. Photos are scaled so the long edge is at most 1600 pixels, and the packet aims to stay under about 5 MB.
- Handoff to the hospital check: household size and yearly income move between the two pages through `sessionStorage`, which the browser clears when the tab closes. "Start over" clears it at once.

## Left to the builder

- Layout and wording inside the existing look. The bill page is "the bill, corrected"; the natural match here is "the notice, answered".
- The pay stub heuristics and their test fixtures (drawn pay stubs, like the drawn bills).
- Module names and boundaries.
- Whether seasonal averaging and local exceptions get a line, depending on what Maryland's page says on build day.

## How we will know it works

- Before building past a demo: show a paper mock of the cover sheet to two counselors, in the interviews that are already planned.
- The two-week test from the October 27 ranking: two assister organizations run 20 real cases through it and log minutes per case and which documents were missing.
- Stop if: fewer than 10 packets get made; or no organization will use a student-built tool with member documents even though nothing leaves the device; or Maryland's own letter and portal walk members through the upload so well that counselors say the cover sheet adds nothing.

## Dates

- January 1, 2027: the rule starts. Proof letters follow.
- November 18: Pitch Dingman showcase, if selected.
- November 19 to 30: the owner is away.
- Size: about two weekend days of building (my estimate). Day one: the rules, the month test, the pay stub reader. Day two: the packet PDF, the record, Spanish, wiring the two pages.

## Builder check, 2026-11-06: eight questions, settled here (my calls)

A reviewer who had not seen the conversation read this document and the code and asked eight questions. Each answer below is my call unless the owner changes it.

1. Which month a pay stub counts toward. The month of the pay date (when the money was received), which is how Medicaid usually counts income. The cover sheet prints each stub's pay period and pay date so a caseworker can see a straddle, and the counselor can move a stub to the other month with one tap. "A month" is a calendar month. The page asks "Which month does your letter ask about?" and defaults to the most recent full month. Confirm with the first counselor.
2. What counts toward $580. Gross pay, before taxes, summed across all jobs, labeled "gross". The federal rule speaks of total monthly income. Self-employment, gig, and cash income can be typed by hand with a note that the state decides what proof it accepts.
3. Proof for work the state cannot see. v2 includes a one-page work statement template: dates, hours, pay, employer or client name and contact, a line for the employer or the member to sign. Without it the headline users (cash and gig workers) would have no packet. The cover sheet's own signature line is the member's attestation of the summary; the work statement is separate. This adds about half a day.
4. The language of the cover sheet. The cover sheet, the page a caseworker reads, is always English. When Spanish is selected, the member's record and a one-page "what is in this packet" sheet are in Spanish. Spanish strings for both pages live in `src/strings.js` as today.
5. Attachments. Pictures and PDFs. pdf-lib copies pages from a PDF; images are converted to JPEG in the page layer. Size budget about 10 MB.
6. Exemption proof hints. Ship them, labeled "what people usually use; Maryland has not published its list and decides for itself." Document types only (a doctor's letter, discharge papers, a birth certificate, a benefits letter), no judgment about whether an exemption applies.
7. When no test is met. The Build button still works. The cover sheet prints the numbers beside each threshold with the line "Below each threshold for this month" and the page suggests trying another month or checking exemptions with Maryland's tool. Saying which test is met is arithmetic, not a judgment of safety.
8. Handoff to the hospital check. The renewal page asks household size (one field) and a yearly household income that the counselor can type, with the proven month times twelve offered as a starting figure. A five-line read of `sessionStorage` on load in `app.js` is allowed; "untouched" means the bill flow's behavior, not the file.

## Check these

1. Counselor first. I chose the counselor at a desk as the main user, with a member alone on a phone as the second. Say so if you see it the other way.
2. No AI model in v2. Sending a document to a model breaks this repo's "zero network requests" rule and makes "nothing leaves your device" false, which is the one promise a clinic will check. I kept it on the device. If you want an AI reading step, that is a separate, opt-in feature with its own privacy wording, and it changes who will agree to try it.
3. No screener of our own. Maryland already has one, so v2 links to it and does proof only. This makes the build smaller and the pitch narrower.
4. A second page (`renew.html`) instead of folding this into the bill page.
5. When to build. November 14 and 15, or after November 30.
6. The work statement template (builder check 3). It is the only proof cash and gig workers can bring. I put it in; it adds half a day.
7. English cover sheet for the caseworker, Spanish sheet for the member (builder check 4). Say so if you want the cover sheet itself in both languages.
