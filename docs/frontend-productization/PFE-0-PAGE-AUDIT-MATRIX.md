<!-- docs/frontend-productization/PFE-0-PAGE-AUDIT-MATRIX.md -->
# PFE-0 Page Audit Matrix

## 0. Purpose

This matrix audits the current repository frontend product surfaces for the Product Frontend Excellence line.

It is intentionally broader than a short route checklist. It uses current repository route files and frozen frontend productization documents as the baseline.

PFE-0 does not create routes, remove routes, redesign pages, or change runtime behavior.

## 1. Classification legend

```text
formal v1 page = primary product page in the v1 frontend baseline
formal sub-surface = detail/tab/sub-route under a formal route family
export/print secondary surface = printable/exportable user-visible surface
URL-only compatibility = reachable route that must not be promoted to formal navigation
future product-contract page = future page requiring a new product contract before implementation
do-not-build page = prohibited formal product surface
```

## 2. Customer Portal matrix

| Route or surface | Classification | Current status | Data source / owner | Boundary | Later PFE owner |
|---|---|---|---|---|---|
| `/customer/dashboard` | formal v1 page | release surface present | Customer Dashboard | customer-visible reporting only | PFE-3 |
| `/customer/fields` | formal v1 page | release surface present | Customer field index | customer-safe field list/report entry | PFE-3 |
| `/customer/fields/:fieldId` | formal sub-surface | release surface present | Field report page | customer-safe field report, no internal governance controls | PFE-3 |
| `/customer/fields/:fieldId/export` | export/print secondary surface | release surface present | Field report export | printable/export surface, no debug/internal leakage | PFE-3 / PFE-12 |
| `/customer/operations` | formal v1 page | release surface present | Customer operations index | reporting surface, not dispatch or AO-ACT | PFE-3 |
| `/customer/operations/:operationId` | formal sub-surface | release surface present | Operation report page | customer-safe operation report, not execution console | PFE-3 |
| `/customer/operations/:operationId/export` | export/print secondary surface | release surface present | Customer operation report export | printable/export surface, no acceptance/debug leakage | PFE-3 / PFE-12 |
| `/customer/reports` | formal v1 page | release surface present | Reports center | customer reports entry surface | PFE-3 |
| `/customer/export` | export/print secondary surface | release surface present | Customer dashboard export | printable/export surface for customer dashboard | PFE-3 / PFE-12 |

### Customer Portal boundary

Customer Portal must not expose the following as formal UI:

```text
Dispatch
AO-ACT
ROI Ledger
Field Memory
Acceptance
Debug
Internal governance labels
Raw contract names as primary product copy
```

Customer pages may reference report evidence and operation status, but they must not become execution-control surfaces.

## 3. Operator Runtime Console matrix

| Route or surface | Classification | Current status | Data source / owner | Boundary | Later PFE owner |
|---|---|---|---|---|---|
| `/operator/twin` | formal v1 page | release surface present | Operator Twin overview | read-only runtime overview, not live production | PFE-4 |
| `/operator/fields` | formal v1 page | route exists but product page incomplete | Field Runtime index | formal route family entry; field selector/list quality not final | PFE-4 |
| `/operator/fields/:fieldId` | formal sub-surface | release surface present | Field Runtime overview | read-only field runtime overview | PFE-4 |
| `/operator/fields/:fieldId/state` | formal sub-surface | release surface present | Field Runtime state tab | state review, not recommendation | PFE-4 |
| `/operator/fields/:fieldId/evidence` | formal sub-surface | release surface present | Evidence tab | evidence/source review, no facts write | PFE-4 |
| `/operator/fields/:fieldId/forecast` | formal sub-surface | release surface present | Forecast tab | forecast review, not recommendation or dispatch | PFE-4 |
| `/operator/fields/:fieldId/scenario` | formal sub-surface | release surface present | Scenario read-only tab | read-only scenario review, no canonical recommendation submission | PFE-4 |
| `/operator/fields/:fieldId/residual` | formal sub-surface | release surface present | Residual / verification tab | response verification, not ROI or causal proof | PFE-4 |
| `/operator/fields/:fieldId/calibration` | formal sub-surface | release surface present | Calibration review tab | calibration review, not model auto-update | PFE-4 |
| `/operator/fields/:fieldId/health` | formal sub-surface | release surface present | Runtime Health review tab | replay-backed health review, not live monitoring | PFE-4 / PFE-6 / PFE-7 |
| `/operator/fields/:fieldId/audit` | formal sub-surface | release surface present | Field Runtime audit tab | route/source/boundary audit, not business conclusion | PFE-4 |
| `/operator/twin/gateway-demo` | formal v1 page | release surface present | Replay-backed Gateway Demo | checked-in/replay-backed snapshot, no live gateway claim | PFE-4 / PFE-12 |
| `/operator/pilot` | formal v1 page | reachable; route ownership cleanup registered | Pilot Readiness | readiness review only, not field pilot start | PFE-4 |

### Operator Runtime Console nonclaims

The following nonclaims must remain visible or auditable where applicable:

```text
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
Controlled Execution: Disabled
AO-ACT Dispatch: Disabled
```

Operator surfaces must not create facts, approve recommendations, dispatch work, create AO-ACT tasks, write ROI, write Field Memory, update models, or claim autonomous operation.

### Operator route ownership note

`/operator/pilot` remains a formal product surface, but explicit route ownership cleanup is already registered as future work.

The cleanup must be handled in PFE-4 or a dedicated route ownership PR, not hidden inside PFE-0.

## 4. Admin Console matrix

| Route or surface | Classification | Current status | Data source / owner | Boundary | Later PFE owner |
|---|---|---|---|---|---|
| `/admin/dashboard` | formal v1 page | release surface present | Admin dashboard | internal governance shell entry | PFE-5 |
| `/admin/fields` | formal v1 page | release surface present | Admin fields | internal field management/readback | PFE-5 |
| `/admin/operations` | formal v1 page | release surface present | Admin operations | internal operations readback/governance | PFE-5 |
| `/admin/devices` | formal v1 page | release surface present | Admin devices | device management/readback, not proof of live deployment | PFE-5 |
| `/admin/evidence` | formal v1 page | release surface present | Admin evidence | governance/readback evidence surface | PFE-5 |
| `/admin/skills` | formal v1 page | release surface present; Config label normalized, route remains technical | Admin skills/config | config-like governance surface, route normalization future | PFE-5 |
| `/admin/healthz` | formal v1 page | release surface present; route naming remains technical | Admin runtime health | admin health readback, route normalization future | PFE-5 |
| `/admin/alerts` | URL-only compatibility | reachable, non-formal | Admin alerts page | must not enter formal nav without product contract | future only |
| `/admin/acceptance` | URL-only compatibility | reachable, non-formal | Admin acceptance page | internal acceptance route, not formal nav | do not promote |
| `/admin/import` | URL-only compatibility | redirect or compatibility route | Admin import compatibility | not productized imports surface | future only |
| `/admin/operations/:operationId/debug` | URL-only compatibility | redirect or compatibility route | operation debug compatibility | debug route, not formal nav | do not promote |

### Admin Console boundary

Admin Console may contain internal governance/readback concepts.

Admin formal navigation must not expose debug, acceptance, fixture, raw import debug surfaces, Dev Tools, Dispatch, AO-ACT, ROI Ledger, Field Memory, Judge Config, Sim Config, or legacy dev tools unless a later product contract explicitly allows and gates that surface.

## 5. Future product-contract pages

| Target route or surface | Classification | Current substitute | Precondition |
|---|---|---|---|
| `/operator/evidence` | future product-contract page | field-scoped evidence tab and preserved legacy evidence routes | operator-level evidence overview contract |
| `/operator/health` | future product-contract page | `/operator/fields/:fieldId/health` | aggregate runtime health read model or Runtime Health Service Gate |
| `/operator/settings` | future product-contract page | none | read-only operator settings contract |
| `/customer/evidence-summary` | future product-contract page | customer reports / field reports | customer-safe evidence summary contract |
| `/admin/tenants` | future product-contract page | none | tenant governance contract |
| `/admin/imports` | future product-contract page | `/admin/import` compatibility route | import/source governance contract |
| `/admin/audit` | future product-contract page | `/admin/evidence` and URL-only acceptance/debug routes | admin audit product contract |
| `/admin/config` | future product-contract page | `/admin/skills` | config route normalization decision |
| `/admin/health` | future product-contract page | `/admin/healthz` | admin health route normalization decision |

Future product-contract pages must not be implemented in PFE-0.

## 6. Do-not-build formal pages

The following are prohibited as formal product surfaces in the current product frontend line:

```text
Customer Dispatch
Customer AO-ACT
Customer ROI Ledger
Customer Field Memory
Operator Dispatch Console
Operator AO-ACT Control
Operator Live Device Monitor
Operator Production Gateway Online
Operator Field Pilot Execution
Admin Debug Formal Page
Admin Acceptance Formal Nav Page
Legacy Dev Tools Formal Page
```

These pages would create false production/runtime/execution claims or leak internal governance/debug concepts into formal product surfaces.

## 7. Quality state summary

PFE-0 records the current quality state without claiming completion.

| Dimension | Current PFE-0 status | Later owner |
|---|---|---|
| page contracts | not closed | PFE-1 |
| design system v1 | not complete; H66 was hardening only | PFE-2 |
| customer portal product polish | incomplete | PFE-3 |
| operator runtime console product polish | incomplete | PFE-4 |
| admin console product polish | incomplete | PFE-5 |
| accessibility / keyboard compliance | baseline documented, not complete | PFE-6 |
| responsive viewport completion | baseline documented, not complete | PFE-7 |
| empty/loading/error state completion | registered, not complete | PFE-8 |
| visual regression | not automated | PFE-9 |
| performance budget | baseline documented, not enforced as full budget | PFE-10 |
| product copy / i18n glossary | bilingual baseline exists, final copy system not complete | PFE-11 |
| demo mode / release candidate | not complete | PFE-12 |
| product frontend v1 freeze | not complete | PFE-13 |

## 8. PFE-0 release status

PFE-0 release status is:

```text
inventory audited
surfaces classified
future pages bounded
do-not-build pages preserved
quality gaps assigned to PFE owners
no route or source changes authorized
```

PFE-0 does not certify a Silicon-Valley-grade product frontend by itself.
