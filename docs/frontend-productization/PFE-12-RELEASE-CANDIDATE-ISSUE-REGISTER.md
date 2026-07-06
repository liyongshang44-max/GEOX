<!-- docs/frontend-productization/PFE-12-RELEASE-CANDIDATE-ISSUE-REGISTER.md -->
# PFE-12 Release Candidate Issue Register

## Register policy

This register records non-blocking gaps after PFE-12. It cannot waive missing manifest, failed runtime audit, failed bundle budget, missing copy gate, route changes, backend changes, package changes, or generated binary artifacts committed to source.

## Non-blocking issues

| issue id | area | severity | reason not fixed in PFE-12 | later owner |
|---|---|---|---|---|
| PFE12-RC-001 | visual assertions | medium | PFE-12 relies on PFE-9 screenshot manifest and does not add full pixel diff. | PFE-13 |
| PFE12-RC-002 | Lighthouse score | medium | PFE-12 relies on PFE-10 build-output budget and does not introduce Lighthouse scoring. | PFE-13 |
| PFE12-RC-003 | RUM | medium | Real-user performance collection is outside this candidate baseline. | PFE-13 |
| PFE12-RC-004 | page-string extraction | medium | PFE-12 relies on PFE-11 copy baseline and does not extract every page string. | PFE-13 |
| PFE12-RC-005 | translation review | low | Native editorial review is outside this engineering candidate. | PFE-13 |
| PFE12-RC-006 | browser/device matrix | medium | Full browser and device matrix remains later work. | PFE-13 |

## Blocking issues not allowed

- blank formal route
- runtime audit failed
- bundle budget failed
- copy / i18n gate failed
- demo manifest missing
- demo seed default mutates data
- route topology changed
- backend, package, fixture, or contract changed
- generated dist or image artifacts committed
- manifest boundary flags set to true

## Future work policy

Future work may add stronger visual assertions, RUM, Lighthouse scoring, native editorial review, and browser/device matrices. These must stay outside the PFE-12 candidate closure unless separately scoped.
