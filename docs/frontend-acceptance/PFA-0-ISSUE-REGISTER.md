<!-- docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md -->
# PFA-0 Issue Register

## Register policy

PFA-0 records page-quality and product-readback-contract issues observed after the PFE-13 freeze. It does not fix page source. A runtime PASS proves only that a route authenticated, rendered non-placeholder content, and produced an artifact; it does not prove localization, responsive behavior, information hierarchy, table readability, demo readiness, or completeness of a readback contract.

The full review evidence was generated on the PFA-1 runtime API-base prerequisite at commit `24c6f9a8803c9738ce0311c35deda5ddfc056dae` with the PFA-0 capture framework inherited from commit `a7809b92b0673b69a96d61d373a7a5da3a86e503`.

```text
30 actual routes
2 locales
3 viewports
180 screenshots
runtime capture result: 180/180 PASS
page quality result: FAIL with retained P1/P2/P1-contract findings
```

## DT-00 governance classification

```text
phase state:
PFA-0 complete
PFA-1 complete
PFA-2 complete
PFA-3 through PFA-7 paused

issue lifecycle:
OPEN_RETAINED_PRODUCT_DEBT

default MCFT impact:
NON_BLOCKING_UNLESS_TRIGGERED
```

PFA issue severity is a product-quality severity. It is not automatically an MCFT runtime-blocking severity.

Promotion to `MCFT_BLOCKER` requires all of:

```text
concrete affected MCFT route or object
reproducible evidence
blocked acceptance requirement
named MCFT owner
removal condition
```

A finding may be promoted only when it prevents required MCFT operation or trace inspection, causes incorrect Twin semantics, hides uncertainty/limitations/safety boundaries, or creates an authorization, write, approval, dispatch, or execution-safety defect.

Promotion does not close the original PFA finding, change its severity, or erase its remediation-phase ownership.

## Issue counts

```text
open findings: 16
resolved PFA-2 findings: 3
resolved capture findings: 2
historical findings: 21
```

Generated screenshots and reports remain local artifacts and must not be committed.

## Open retained product-quality debt

| issue id | severity | remediation phase | lifecycle | default MCFT impact | surface | route area | issue |
|---|---|---|---|---|---|---|---|
| PFA0-CUS-002 | P2 | PFA-6 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | field and operation lists | Demo data shows unnamed or weakly labelled fields and operations, reducing demonstration credibility. |
| PFA0-CUS-003 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | `/customer/reports` | Reports center is too dense for formal demonstration and becomes an excessive scroll surface. |
| PFA0-CUS-004 | P2 | PFA-6 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | fields and operations tables | Long IDs and wrapped badges reduce table readability. |
| PFA0-CUS-005 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | `/customer/reports` | Reports center remains viewport-sensitive at laptop and mobile widths. |
| PFA0-CUS-006 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | `/customer/dashboard` | Report-entry content is duplicated, desktop columns are imbalanced, and mobile content becomes a long mechanical stack. |
| PFA0-OPR-001 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator | source inventory and gateway demo | Source inventory tables have weak column readability and long reference overflow. |
| PFA0-OPR-002 | P1 | PFA-3 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator | field runtime detail | Runtime detail pages are compressed and rely on horizontal overflow or excessively wide content. |
| PFA0-OPR-003 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator | pilot readiness | Pilot readiness cards and nested tables are difficult to scan and demonstrate. |
| PFA0-OPR-004 | P2 | PFA-6 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator | field runtime list | Main content is narrow while available horizontal space is underused. |
| PFA0-OPR-005 | P1 | PFA-3 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator | laptop and mobile viewports | Operator table, detail, and pilot routes remain viewport-sensitive. |
| PFA0-ADM-001 | P2 | PFA-6 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Admin | admin tables | Some admin field names and values wrap awkwardly. |
| PFA0-ADM-003 | P1-contract | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Admin | `/admin/devices` | Admin Devices is currently limited to inventory readback. Product acceptance requires device asset and status readback governance, including identity, field binding, connectivity, telemetry recency, health state, declared capability, and source evidence, without claiming live monitoring, device control, or production gateway operation. |
| PFA0-RWD-001 | P1 | PFA-3 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Operator / Customer | mobile and selected desktop routes | Real document-width overflow was observed, including Operator Health, Evidence, Residual, Gateway Demo, and a smaller Customer Dashboard desktop overflow. |
| PFA0-NAV-001 | P2 | PFA-3 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer / Operator / Admin | mobile shell | Mobile pages render the full desktop navigation before page content instead of a compact drawer or collapsible shell. |
| PFA0-EXP-001 | P1 | PFA-4 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer | export and print routes | Export tables and report layouts are unreadable at mobile width; headings and cells collapse into narrow vertical fragments. |
| PFA0-DEN-001 | P1 | PFA-5 | OPEN_RETAINED_PRODUCT_DEBT | NON_BLOCKING_UNLESS_TRIGGERED | Customer / Operator | reports, gateway, audit, calibration, pilot | Several pages exceed roughly 10–17 viewport heights without sectional navigation, progressive disclosure, pagination, or summary/detail separation. |

No finding is closed, downgraded, or reassigned by DT-00.

## Resolved PFA-2 findings

| issue id | former severity | status | evidence |
|---|---|---|---|
| PFA0-I18N-001 | P1 | closed by PFA-2 | Strengthened complete-visible-text audit passed on 30 routes × 2 locales: 60/60 route health, 30/30 differentiated locale pairs, 30/30 role-boundary equivalence and mandatory presence, and 30/30 pathname equivalence. |
| PFA0-CUS-001 | P1 | closed by PFA-2 | All 9 Customer routes passed the strengthened bilingual runtime contract; product copy is localized and source-owned business names are explicitly separated from governed locale copy. |
| PFA0-ADM-002 | P2 | closed by PFA-2 | All 7 Admin routes passed the strengthened bilingual runtime contract, including localized static metric values and explicit neutral treatment for technical field identifiers. |

PFA-2 closure evidence is recorded in `PFA-2-RUNTIME-EVIDENCE.md`, `PFA-2-ISSUE-CLOSURE.md`, and the 30-record `PFA-2-ROUTE-LOCALE-MATRIX.json` with every record at `runtime-pass`.

## Admin Device Status Readback Contract

`PFA0-ADM-003` remains a P1 product-contract gap. Its accepted read-only contract must cover:

```text
device identity
device asset record
field binding
connectivity readback
telemetry recency
health / degraded / unavailable state
declared capability
source evidence
```

Required state semantics:

```text
known
unknown
unavailable
stale
degraded
```

Safety and truthfulness boundaries:

```text
do not fabricate real-time connectivity
do not claim live monitoring
do not expose device control or restart
do not expose gateway actions
do not expose AO-ACT dispatch
show unavailable or source missing when evidence is absent
```

## Resolved capture findings

| issue id | former severity | status | evidence |
|---|---|---|---|
| PFA0-CAP-001 | P1 | resolved by full capture | All parameterized formal routes were captured in `zh-CN` and `en-US` at desktop, laptop, and mobile viewports. |
| PFA0-CAP-002 | P1 | resolved by authenticated full capture | Authenticated Admin routes completed successfully in all six locale/viewport combinations per route. |

Resolution of capture gaps does not close the remaining product-quality or product-contract findings.

## Current blocking policy

```text
PFA-3 through PFA-7 are paused product-quality phases.
The 16 unresolved findings remain OPEN_RETAINED_PRODUCT_DEBT.
They do not globally block DT or MCFT.
An individual finding blocks MCFT only after evidence-based promotion to MCFT_BLOCKER.
```

The former statement that all open P1 and P1-contract issues block subsequent runtime-kernel work is historical policy superseded by DT-00 and is not the current blocking policy.

## Forbidden completion claim

PFA-0 must not claim that all page quality has been fixed, that all pages are product-grade complete, that Admin Devices has a complete status-readback contract, or that `180/180 PASS` is page-quality acceptance. DT-00 must not claim that retained findings were repaired.
