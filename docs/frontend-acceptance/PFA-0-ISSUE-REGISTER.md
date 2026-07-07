<!-- docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md -->
# PFA-0 Issue Register

## Register policy

PFA-0 records page-quality issues observed after the PFE-13 freeze. It does not fix page source. A runtime PASS only proves that a route authenticated, rendered non-placeholder content, and produced an artifact; it does not prove i18n, responsive behavior, information hierarchy, table readability, or demo readiness.

The full review evidence was generated on the PFA-1 runtime API-base prerequisite at commit `24c6f9a8803c9738ce0311c35deda5ddfc056dae` with the PFA-0 capture framework inherited from commit `a7809b92b0673b69a96d61d373a7a5da3a86e503`.

```text
30 actual routes
2 locales
3 viewports
180 screenshots
runtime capture result: 180/180 PASS
page quality result: FAIL with P1/P2 findings
```

Generated screenshots and reports remain local artifacts and must not be committed.

## Open findings from full screenshot review

| issue id | severity | remediation phase | surface | route area | issue |
|---|---|---|---|---|---|
| PFA0-I18N-001 | P1 | PFA-2 | Customer / Operator / Admin / Supporting | all localized surfaces | `zh-CN` and `en-US` do not produce complete, mutually consistent locale output. English remains in Chinese pages, Chinese remains in English pages, and some locale pairs are effectively identical. |
| PFA0-CUS-001 | P1 | PFA-2 | Customer | customer shell and reports | Customer pages contain mixed-language product labels, status terms, section titles, and report terminology. |
| PFA0-CUS-002 | P2 | PFA-6 | Customer | field and operation lists | Demo data shows unnamed or weakly labelled fields and operations, reducing demonstration credibility. |
| PFA0-CUS-003 | P1 | PFA-5 | Customer | `/customer/reports` | Reports center is too dense for formal demonstration and becomes an excessive scroll surface. |
| PFA0-CUS-004 | P2 | PFA-6 | Customer | fields and operations tables | Long IDs and wrapped badges reduce table readability. |
| PFA0-CUS-005 | P1 | PFA-5 | Customer | `/customer/reports` | Reports center remains viewport-sensitive at laptop and mobile widths. |
| PFA0-CUS-006 | P1 | PFA-5 | Customer | `/customer/dashboard` | Report-entry content is duplicated, desktop columns are imbalanced, and mobile content becomes a long mechanical stack. |
| PFA0-OPR-001 | P1 | PFA-5 | Operator | source inventory and gateway demo | Source inventory tables have weak column readability and long reference overflow. |
| PFA0-OPR-002 | P1 | PFA-3 | Operator | field runtime detail | Runtime detail pages are compressed and rely on horizontal overflow or excessively wide content. |
| PFA0-OPR-003 | P1 | PFA-5 | Operator | pilot readiness | Pilot readiness cards and nested tables are difficult to scan and demonstrate. |
| PFA0-OPR-004 | P2 | PFA-6 | Operator | field runtime list | Main content is narrow while available horizontal space is underused. |
| PFA0-OPR-005 | P1 | PFA-3 | Operator | laptop and mobile viewports | Operator table, detail, and pilot routes remain viewport-sensitive. |
| PFA0-ADM-001 | P2 | PFA-6 | Admin | admin tables | Some admin field names and values wrap awkwardly. |
| PFA0-ADM-002 | P2 | PFA-2 | Admin | admin shell | Localized admin pages retain mixed governance terminology. |
| PFA0-RWD-001 | P1 | PFA-3 | Operator / Customer | mobile and selected desktop routes | Real document-width overflow was observed, including Operator Health, Evidence, Residual, Gateway Demo, and a smaller Customer Dashboard desktop overflow. |
| PFA0-NAV-001 | P2 | PFA-3 | Customer / Operator / Admin | mobile shell | Mobile pages render the full desktop navigation before page content instead of a compact drawer or collapsible shell. |
| PFA0-EXP-001 | P1 | PFA-4 | Customer | export and print routes | Export tables and report layouts are unreadable at mobile width; headings and cells collapse into narrow vertical fragments. |
| PFA0-DEN-001 | P1 | PFA-5 | Customer / Operator | reports, gateway, audit, calibration, pilot | Several pages exceed roughly 10–17 viewport heights without sectional navigation, progressive disclosure, pagination, or summary/detail separation. |

## Resolved capture findings

| issue id | former severity | status | evidence |
|---|---|---|---|
| PFA0-CAP-001 | P1 | resolved by full capture | All parameterized formal routes were captured in `zh-CN` and `en-US` at desktop, laptop, and mobile viewports. |
| PFA0-CAP-002 | P1 | resolved by authenticated full capture | Authenticated Admin routes completed successfully in all six locale/viewport combinations per route. |

Resolution of capture gaps does not close the page-quality findings exposed by those screenshots.

## Blocking policy

```text
PFA-1 closes runtime API-base and capture enablement only.
PFA-2 through PFA-5 contain open P1 remediation work.
PFA-6 contains P2 polish and demo-data work.
PFA-7 is the final full recapture and closure gate.
```

Open P1 issues block subsequent runtime-kernel work until they are remediated or explicitly reclassified with evidence.

## Forbidden completion claim

PFA-0 must not claim that page quality has been fixed, that all pages are product-grade complete, or that `180/180 PASS` is page-quality acceptance.