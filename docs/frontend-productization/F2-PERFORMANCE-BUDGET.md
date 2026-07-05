# F2 Performance Budget

## Phase

F2-F Performance Budget.

## Purpose

Prevent accidental frontend bloat and route-loading regression before frontend freeze.

F2 establishes a qualitative budget. It does not introduce a bundle analyzer, package dependency, or performance tooling PR.

## Required register

The F2 baseline requires:

- build:web passes
- build output size reviewed
- largest bundle recorded
- known heavy pages listed
- no new package dependency
- no heavyweight dependency
- no accidental full i18n library import
- no eager import of all formal surfaces into the shell
- route lazy-loading preserved
- large static copy registry does not import runtime data
- copy registry does not import API clients
- LocaleToggle does not import API clients
- performance budget is not weakened to pass

## Build output size reviewed

Latest local build output reviewed on PR head `42f267e41ee01c05acd3b01d36f60218270b424b` and later F2 docs-only updates.

Largest bundle recorded:

| Bundle | Size | Gzip |
| --- | --- | --- |
| `dist/assets/index-Bj_GToGs.js` | 411.98 kB | 109.21 kB |

## Known heavy pages listed

Known heavy output entries from the reviewed build:

| Bundle / page artifact | Size | Gzip | Risk |
| --- | --- | --- | --- |
| `dist/assets/index-Bj_GToGs.js` | 411.98 kB | 109.21 kB | application shell baseline risk |
| `dist/assets/metricDisplayPolicy-C0lHIGi1.js` | 89.46 kB | 20.86 kB | shared display policy size |
| `dist/assets/FlightTablePage-qwzPXsZa.js` | 65.58 kB | 16.35 kB | table-heavy page |
| `dist/assets/OperationDetailPage-BeWceK16.js` | 51.50 kB | 14.15 kB | detail page size |
| `dist/assets/CommercialDashboardPage-BbmIePjK.js` | 46.16 kB | 14.94 kB | dashboard page size |
| `dist/assets/OperationReportPage-DYdo4sFe.js` | 41.56 kB | 13.73 kB | report page size |
| `dist/assets/FieldDetailPage-B_Qpx7qW.js` | 40.73 kB | 12.61 kB | detail page size |
| `dist/assets/OperatorDevicesAlertsPage-ibl5VQ72.js` | 34.83 kB | 11.02 kB | operator page size |
| `dist/assets/operatorRoiLedgerVm-B5QjDap_.js` | 31.19 kB | 10.42 kB | view-model size |
| `dist/assets/OperatorEvidenceTwinPage-Co_BQi5H.js` | 30.99 kB | 9.39 kB | evidence page size |

## No accidental full i18n library import

F2 uses the existing local LocaleProvider and static localized copy helpers. It must not import a full i18n library accidentally. `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are blocked in F2.

## Budget categories

| Category | Budget |
| --- | --- |
| Application shell budget | Do not eagerly import all formal pages into a shell. |
| Operator formal surface budget | Keep route-level loading behavior and avoid dispatch/live-runtime imports. |
| Customer formal surface budget | Keep Customer pages scoped to Customer read surfaces and export scaffolds. |
| Admin formal surface budget | Keep Admin pages scoped to governance/readback surfaces. |
| Static copy registry budget | May contain bilingual copy but must not import API clients or runtime data. |
| CSS budget | Use shared primitives and existing shell styles; do not add package-level CSS framework dependency. |

## Dependency boundary

No package dependency changes are allowed in F2. `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are blocked.

## Route loading boundary

Route lazy-loading must be preserved. F2 must not move all formal surfaces into eager imports from shell/layout code.

## Copy registry boundary

The copy registries must remain static text registries. They must not import API clients, backend callers, route modules, or runtime state.

## LocaleToggle boundary

LocaleToggle remains local UI state only. It must not import API clients. It must not call backend APIs. It must not change route topology.

## Acceptance hooks

The F2 acceptance gate checks build output size reviewed, largest bundle recorded, known heavy pages listed, no new dependency, no heavyweight dependency, no accidental full i18n library import, no eager import, route lazy-loading preserved, copy registry does not import API clients, and LocaleToggle does not import API clients.

## Non-goals

No bundle analyzer. No automated performance lab result. No package-approved dependency introduction. No runtime production readiness claim.
