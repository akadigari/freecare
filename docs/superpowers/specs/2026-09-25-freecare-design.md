# freecare: Maryland hospital free-care checker (design)

Date: 2026-09-25. Status: draft for owner review. Working name, easy to change.

## What it is

A one-page tool that tells a Maryland patient, in under a minute, whether state law says their hospital bill should be free or discounted, how many days they have left to apply, and what to bring. It runs entirely in the browser. Nothing is sent anywhere.

It is the first real piece of the "AI agent that checks if your hospital bill should legally be $0" from the Startup Shell application (Part 2), and the progress demo for the Shell interview.

## Who it is for

First: students and families around College Park. Second: the Shell interviewer, who types in a household and sees the answer.

## Success looks like

- Family of 4 making $60,000 gets "free care." $70,000 gets "75% off." $95,000 gets "60% off."
- Every cutoff matches Maryland law, with a test at each exact boundary.
- Works on a phone, works offline, makes zero network requests.
- Every result says which law it comes from, with a link.

## The rules

Sources: Maryland Health-General 19-214.1, COMAR 10.37.13.06, and the HHS 2026 poverty guidelines (published Jan 15, 2026).

Poverty line, 2026, 48 states and DC: $15,960 for 1 person, plus $5,680 for each extra person. This matches the HHS table for sizes 1 to 8.

| Situation | Result |
|---|---|
| On SNAP, WIC, or Maryland Energy Assistance, or a child gets free or reduced-price school meals | Free (automatic) |
| Income at or below 200% of the poverty line | Free |
| Over 200%, up to 250% | 75% off |
| Over 250%, up to 300% | 60% off |
| Over 300%, up to 500%, and medical bills from the last 12 months are more than 25% of income | 50% off (to 350%), 45% (to 400%), 40% (to 450%), 35% (to 500%) |
| Over 300% without that hardship, or over 500% | State law does not require a discount. Ask the hospital anyway |
| Not a Maryland resident | The state rule does not cover you. Check the hospital's own policy |

- Deadline: 240 days after the first hospital bill.
- Always shown: hospitals can be more generous than this, some hospitals count savings too, and this is not legal advice.
- Reading of the bands: "201 to 250 percent" is read as over 200 up to and including 250, and so on.

**Open question to settle first in the build:** confirm from the regulation text whether the 301% to 500% tiers apply only with financial hardship (what COMAR 10.37.13.06 appears to say) or to everyone (one reading of the statute summary). The table above assumes hardship only.

## Inputs

Household size (1 to 20), yearly household income before taxes, Maryland resident (yes or no), the four programs (checkboxes), date of first bill (optional), medical bills in the last 12 months (optional).

## Output

The tier and discount, income as a percent of the poverty line, days left to apply (or "it's been more than 240 days, ask anyway"), what to bring (proof of income, household size, the bill), and the law it is based on.

## How it is built

- `src/rules.js`: plain functions with no page code. `povertyLine(size)`, `percentOfPovertyLine(income, size)`, `hasHardship(medicalBills, income)`, and `checkEligibility(input, today)` that returns a plain result object. Bad input throws a clear error.
- `src/rules.test.js`: Node's built-in test runner (`node --test`), no dependencies. Written before the code.
- `index.html` and `src/app.js`: the form and the result. System fonts, no external requests.
- Runs locally with `python3 -m http.server` (browsers need a server for modules). No build step.
- Lives in its own folder, `Kadigari/freecare`, with its own CLAUDE.md like the other projects.

## Tests, written first

- Every boundary: 200, 200.01, 250, 250.01, 300, 300.01, 350, 400, 450, 500, 500.01 percent.
- Household sizes 1, 4, 8, 9 and 12, checked against the formula and the HHS table.
- Each program alone makes the result free, whatever the income.
- Hardship at exactly 25% (not hardship) and just over 25% (hardship).
- Income of 0.
- Bad inputs throw: size 0, negative income, not a number, a first-bill date in the future.
- Not a Maryland resident.
- Deadline on day 240 (still open) and day 241 (past).

## Not in version 1

Reading a photo of the bill, picking a hospital and linking its policy, filling Maryland's uniform application, other states, accounts, and hosting. Putting it online (for example on Vercel) waits for the owner's OK.

## Risks

- The poverty numbers change every January: they live in one constant with the source and date, and a test pins them.
- People treating it as legal advice: a plain note on every result.
