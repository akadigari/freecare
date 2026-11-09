# freecare

Browser-only checker for Maryland hospital free and reduced-cost care.
Spec: docs/superpowers/specs/2026-09-25-freecare-design.md. Plan: docs/superpowers/plans/2026-09-26-freecare.md.
Run tests: `npm test` (Node 22, no dependencies). Preview: `python3 -m http.server 8780` in this folder.
Rules: zero network requests from the page, zero em dashes, no commits without the owner's OK.
Update `src/poverty.js` every January when HHS publishes new guidelines.
`renew.html` is the Medicaid proof-packet page; its rules live in `src/workrule.js`. Re-read https://www.marylandhealthconnection.gov/checkin/ before each build and update `RULES.verified`. Spec: docs/superpowers/specs/2026-11-06-renewal-packet-design.md. Plan: docs/superpowers/plans/2026-11-08-renewal-packet.md.
