<!-- docs/frontend-productization/F1-D-CUSTOMER-ADMIN-BILINGUAL-SURFACES.md -->
# F1-D Customer / Admin Formal Surface Bilingualization

## Phase

F1-D Customer / Admin Formal Surface Bilingualization follows F1-C Operator Formal Surface Bilingualization.

F1-D only covers Customer and Admin formal surfaces.

F1-D does not cover Operator.

## Purpose

F1-D bilingualizes Customer and Admin formal product-copy surfaces while preserving raw/source/backend-returned values.

```text
Customer and Admin formal surfaces have bilingual product-level copy, while raw/source/backend-returned values remain unchanged.
```

## Preconditions

F1-C is complete and accepted.

F1-A/F1-B already provide LocaleProvider, useLocale, localizedText, LocaleToggle visibility in Customer/Admin shells, and product surface label registries.

## Allowed files

```text
apps/web/src/features/customer/pages/
apps/web/src/features/admin/pages/
apps/web/src/features/fields/pages/FieldReportPage.tsx
apps/web/src/features/fields/pages/FieldReportExportPage.tsx
apps/web/src/features/operations/pages/OperationReportPage.tsx
apps/web/src/features/operations/pages/OperationReportExportPage.tsx
apps/web/src/views/CustomerDashboardPage.tsx
apps/web/src/views/CustomerFieldsIndexPage.tsx
apps/web/src/views/CustomerOperationsIndexPage.tsx
apps/web/src/views/CustomerReportsCenterPage.tsx
apps/web/src/views/CustomerReportExportPage.tsx
apps/web/src/views/CustomerDashboardExportPage.tsx
apps/web/src/views/FieldReportPage.tsx
apps/web/src/views/FieldReportExportPage.tsx
apps/web/src/views/OperationReportPage.tsx
apps/web/src/views/OperationReportExportPage.tsx
apps/web/src/lib/customerLabels.ts
apps/web/src/lib/productSurfaceLabels.ts
apps/web/src/styles/customerShell.css
apps/web/src/styles/adminShell.css
scripts/frontend_acceptance/ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1.cjs
docs/frontend-productization/F1-D-CUSTOMER-ADMIN-BILINGUAL-SURFACES.md
```

The `views/` entries are allowed because the Customer route entry files in `features/customer/pages/` are re-export wrappers for the actual renderers.

## Forbidden files

```text
apps/web/src/app/App.tsx
apps/web/src/app/routes/
apps/web/src/layouts/
apps/web/src/features/operator/
apps/web/src/views/DevToolsPage.tsx
apps/server/
migrations/
packages/contracts/
fixtures/
.github/
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Customer surface scope

F1-D covers Customer Dashboard, Customer Fields, Customer Field Report, Customer Field Report Export, Customer Operations, Customer Operation Report, Customer Operation Report Export, Customer Reports, and Customer Export at product-copy level.

Implemented in this increment:

```text
Customer Fields
Customer Operations
Customer Dashboard Export
Customer Field Report Export
```

Some Customer report renderers are covered raw/source-backed and are not rewritten in this increment because tool-side file update checks blocked full-file replacement. They remain inside the documented allowlist for the next repair if required.

## Admin surface scope

F1-D covers Admin Dashboard, Fields, Operations, Devices, Evidence, Runtime Health, and Skills / Config labels at product-copy level.

Formal Admin pages avoid the legacy control-plane shell nav that includes URL-only surfaces.

## Customer internal-leakage boundary

Customer formal UI must remain customer-safe, report-oriented, read-only, and free of internal execution controls.

Customer visible formal copy must not expose Dispatch, AO-ACT, ROI Ledger, Field Memory, Debug, Acceptance, Internal governance labels, fixture, Dev Tools, operator workbench, or admin-only route labels as customer actions, cards, filters, or status badges.

## Admin formal-nav pollution boundary

Admin formal pages may use internal governance copy but must not add debug, acceptance, import raw debug surface, legacy dev tools, Dev Tools, fixture, or temporary route labels to formal nav.

URL-only compatibility may remain outside formal nav.

## Raw/source text boundary

F1-D must not translate:

```text
route paths
source identifiers
fact IDs
trace IDs
decision cycle IDs
tenant IDs
project IDs
group IDs
field IDs
operation IDs
device IDs
commit hashes
determinism hashes
acceptance script names
raw evidence payload
raw source labels
contract kind
API field names
enum values
backend-returned domain object values
```

These values are traceability, audit, source identity, backend data, or contract semantics. Translating them would damage evidence integrity.

## Bilingual copy governance

Repeated labels should use shared shell labels or a formal copy object.

One-off page copy may use local localizedText objects.

Backend-returned values must not be passed through translation helpers.

## Acceptance

```text
node scripts/frontend_acceptance/ACCEPTANCE_F1_D_CUSTOMER_ADMIN_BILINGUAL_SURFACES_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

Acceptance is static repo read-only. It does not start the app, call backend, call DB, write facts, or mutate source.

F1-D changed-file validation uses F1-C accepted head as base:

```text
4386faa1cce604d383f288da5156c6b9a0b95885
```

## Non-goals

F1-D does not cover Operator.
F1-D does not translate raw evidence or identifiers.
F1-D does not translate backend-returned values.
F1-D does not change route topology.
F1-D does not change runtime semantics.
F1-D does not claim live runtime readiness.
F1-D does not add Admin debug / acceptance / import raw debug surfaces to formal nav.
F1-D does not expose Dispatch, AO-ACT, ROI Ledger, Field Memory, Debug, Acceptance, or internal governance concepts to Customer formal UI.

## Next phase

F1-D prepares F2-A Accessibility Baseline.

F2-A may cover landmarks, aria labels, nav active state, focus-visible, button/link semantics, heading order, and screen-reader-readable structure.
