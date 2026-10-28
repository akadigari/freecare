# freecare

Should your Maryland hospital bill be free? A one-page checker that answers in about a minute, using Maryland's own rules. It runs entirely in your browser: nothing you type is sent anywhere.

## What it does today

- Tells you whether state law says your care should be free, 75% off, 60% off, or a hardship discount, and that the hospital makes the final decision
- Shows your household income as a percent of the federal poverty line
- Counts the days you have left to apply (240 from the first bill)
- Lists what to bring, and which law the answer comes from
- Works in English and Spanish. A switch at the top of the page changes every word, including the results and the error messages. The choice is remembered in your browser only.
- Lets you pick your hospital (19 Maryland hospitals and health systems, from the state's own list) and links to that hospital's policy on the state's site, with a plain line on where to send the form.
- Fills in Maryland's statewide financial assistance application for you. Every Maryland hospital uses the same form (revised March 6, 2026). You add your name, address, phone and household members; the page puts those and your income, residency and hardship answers into the state's own PDF and downloads it. The signature line stays blank for you to sign. The PDF is built on your device with pdf-lib; the page fetches only its own copy of the form.

## The rules

Poverty line (HHS, 2026, 48 states and DC, published Jan 15, 2026): $15,960 for 1 person plus $5,680 for each extra person.

| Situation | Result |
|---|---|
| On SNAP, WIC, or Maryland Energy Assistance, or a child gets free or reduced-price school meals | Free |
| Income at or below 200% of the poverty line | Free |
| Over 200%, up to 250% | 75% off |
| Over 250%, up to 300% | 60% off |
| Over 300%, up to 500%, and medical bills in the last 12 months are more than 25% of income | 50%, 45%, 40% or 35% off |
| Over 300% without that hardship, or over 500% | Not required by state law. Ask the hospital anyway |
| Not a Maryland resident | Not covered by the state rule. Check the hospital's own policy |

Sources: [Maryland Health-General 19-214.1](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&enactments=false&section=19-214.1), [COMAR 10.37.13.06](https://regs.maryland.gov/us/md/exec/comar/10.37.13.06), [HHS poverty guidelines](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines). Checked September 2026. This is a guide, not legal advice. Hospitals can be more generous, and some also look at savings.

## Run it

```
npm test                      # 80 tests, Node 22, no dependencies to install
python3 -m http.server 8780   # then open http://localhost:8780
```

## How it is built

| File | Job |
|---|---|
| `src/poverty.js` | The 2026 poverty line. Update every January |
| `src/dates.js` | Date-only math that never shifts across time zones |
| `src/rules.js` | Maryland's tiers, hardship, programs and the 240-day window |
| `src/form.js` | Turns what people type ("$60,000") into clean input |
| `src/present.js` | Plain-English results |
| `src/check.js` | Runs a check from form fields to result, and turns any unexpected error into a clear message |
| `src/apply.js` | Maps the answers onto the state form's fields and fills the PDF. The yes or no questions are radio groups; the left box is Yes |
| `src/strings.js`, `src/i18n.js` | Every word on the page in English and Spanish, and the switch between them. The tests check that the English on the page matches the English in the strings file |
| `src/hospitals.js` | The 19 hospitals and health systems with each one's policy link, read from HSCRC's Financial Assistance Policies page on 2026-10-28. No phone numbers on purpose |
| `forms/` | The blank state form, downloaded from a Maryland hospital's copy of the HSCRC form, revised 2026-03-06 |
| `vendor/pdf-lib/` | pdf-lib 1.17.1 (MIT), used to fill the form in the browser |
| `src/app.js`, `index.html`, `src/styles.css` | The page. System fonts, no outside requests |

## Not in this version

Reading a photo of the bill, other states, hospital phone numbers, and a public URL. The form filler does not ask about Medicaid or assets; those questions are left blank for you to answer on the PDF. The filled form is the English state form even when the page is in Spanish; hospitals accept it either way.
