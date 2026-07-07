<!-- docs/frontend-acceptance/PFA-2-LOCALE-CONTRACT.md -->
# PFA-2 Locale Contract Completion

## 1. Phase and entry condition

```text
Phase: PFA-2 Locale Contract Completion
Base: main after PFA-1 merge commit 5168ac25ee634b0a579ac15a696f9e72037ed448
Formal locales: zh-CN, en-US
Formal actual routes: 30
```

PFA-2 establishes complete, intentional, and role-safe bilingual product output. It does not add translation volume as an end in itself and does not introduce a third-party i18n framework.

## 2. Issue ownership

PFA-2 owns and must close:

```text
PFA0-I18N-001  global bilingual output is incomplete or non-exclusive
PFA0-CUS-001   Customer product output mixes Chinese and English
PFA0-ADM-002   Admin governance terminology mixes Chinese and English
```

PFA-2 does not close:

```text
PFA0-RWD-001   PFA-3
PFA0-NAV-001   PFA-3
PFA0-EXP-001   PFA-4
PFA0-DEN-001   PFA-5
PFA0-ADM-003   PFA-5
PFA0-CUS-002   PFA-6
PFA0-CUS-004   PFA-6
PFA0-ADM-001   PFA-6
```

Export and print titles, table headings, statuses, descriptions, footer copy, and ARIA labels are in scope. Export responsive layout, table reflow, character wrapping, and print-only layout strategy remain PFA-4.

## 3. Architecture decision

PFA-2 continues to use:

```text
LocaleProvider
useLocale
localizedText
LocalizedCopy { zh, en }
typed local copy catalogs
```

PFA-2 does not introduce:

```text
i18next
react-intl
formatjs
machine translation
remote translation services
runtime remote copy services
URL locale parameters
```

`zh-CN` and `en-US` are the only supported locale values. Locale state is persisted in localStorage, shared before and after authentication, and reflected in `document.documentElement.lang`.

## 4. Formal copy ownership model

Every governed visible-copy record must be traceable to:

```text
surfaceOwner
copyKind
zh-CN
en-US
roleBoundary
sourceFile
```

Allowed `copyKind` values:

```text
shell
navigation
pageTitle
pageLead
sectionTitle
sectionDescription
tableColumn
status
metricLabel
emptyState
loadingState
errorState
unavailableState
boundary
nonclaim
actionLabel
formLabel
placeholder
ariaLabel
exportPrint
```

A copy pair must contain non-empty `zh` and `en` values. An identical pair is prohibited unless the token is registered as locale-neutral in `PFA-2-LOCALE-EXCEPTION-REGISTER.md`.

## 5. Copy and data separation

Governed product copy includes titles, leads, navigation, table headings, status labels, badges, empty/loading/error/unavailable states, buttons, prompts, form labels, placeholders, ARIA labels, boundary statements, nonclaims, export/print labels, and display labels for known enums.

The following values are locale-neutral data by default and must remain data values rather than product headings:

```text
device_id
field_id
operation_id
trace_id
evidence_ref
URL
API
JSON
SHA-256
raw timestamps
user-entered names
backend-provided real business names
```

A technical ID must not become the page title or primary product label when a product label is available.

## 6. Backend text boundary

Raw backend error strings and enum values must not be displayed as product copy.

```text
backend code
→ frontend semantic mapping
→ zh-CN / en-US display copy
```

Unknown failures use a safe localized fallback. Product DOM must not expose raw stack traces or internal tokens such as:

```text
AUTH_INVALID
blocking_reason
source_evidence_refs
INTERNAL_SERVER_ERROR
```

## 7. Role-safety equivalence

The two locales must preserve the same capability and safety boundary.

Customer output may describe reports, operating overview, authorized scope, operation progress, acceptance state, and deliverable reports. It must not imply dispatch, approval, fact writes, AO-ACT, evidence mutation, or production control.

Operator output may describe source, evidence, replay, adapter, residual, calibration, readback, and runtime. Both locales must state the same read-only, review-only, non-dispatch, non-live-device, production-gateway-offline, and field-pilot-not-started boundaries.

Admin output may describe governance, readback, inventory, source evidence, health readback, and skills/config readback. It must not imply production control, service actions, live monitoring, device restart, gateway actions, or AO-ACT dispatch.

## 8. RuntimeTextGuard decision

PFA-2 prohibits expanding `RuntimeTextGuard`.

Closure requires:

```text
formal Customer layout dependency = 0
formal Operator layout dependency = 0
formal Admin layout dependency = 0
formal route replacement dependency = 0
replacement count = 0, or component removed
```

Existing replacement causes must be corrected at source component, view-model, or typed copy-catalog level. DOM mutation is not an accepted locale mechanism.

## 9. Runtime audit contract

The PFA-2 runtime audit uses a real browser login and covers:

```text
30 actual routes
2 locales
1 desktop locale-review viewport: 1440 x 1100
60 route-locale renders
```

Each render verifies route health, no unexpected login redirect, no auth placeholder, matching `html lang`, matching LocaleToggle state, required markers, forbidden-marker absence, safe governed copy, ARIA labels, no raw error code, no raw copy key, and no RuntimeTextGuard dependency.

Each route pair verifies identical pathname and role boundary, equivalent capability claims, differentiated governed-copy fingerprints, and differentiated required title/boundary/status copy except registered locale-neutral tokens.

## 10. Allowed implementation boundary

Allowed runtime paths are limited to:

```text
apps/web/src/lib/locale.tsx
apps/web/src/lib/productSurfaceLabels.ts
apps/web/src/lib/productCopy/*
apps/web/src/components/common/LocaleToggle.tsx
apps/web/src/components/common/RuntimeTextGuard.tsx
apps/web/src/design-system/product/*
apps/web/src/layouts/CustomerLayout.tsx
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/layouts/AdminLayout.tsx
apps/web/src/views/LoginPage.tsx
apps/web/src/features/customer/pages/*
apps/web/src/features/operator/pages/*
apps/web/src/features/operator/fieldRuntime/*
apps/web/src/features/operator/replayDemo/*
apps/web/src/features/operator/pilotReadiness/*
apps/web/src/features/admin/pages/*
apps/web/src/features/fields/pages/FieldReportPage.tsx
apps/web/src/features/fields/pages/FieldReportExportPage.tsx
apps/web/src/features/operations/pages/OperationReportPage.tsx
```

The three existing Customer report pages outside `features/customer/pages` are included because the frozen Customer routes render those files directly.

## 11. Prohibited boundary

PFA-2 must not modify:

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/package.json
apps/web/src/app/routes/*
apps/web/src/api/*
apps/web/dist/*
docs/audit/**/*.png
```

It must not change authentication, API base, routes, Customer/Operator/Admin capabilities, Admin Device state models, responsive layout, page density, or demo data.

## 12. Completion boundary

PFA-2 is complete only when all 30 routes and both locales pass the 60-render runtime contract; Customer, Operator, Admin, Login, shared states, export copy, and ARIA copy are bilingual; `html lang` is correct; RuntimeTextGuard formal dependency is zero; no third-party dependency is added; and CI passes.

The following ownership statements remain in force:

```text
Responsive acceptance remains owned by PFA-3.
Export layout acceptance remains owned by PFA-4.
Information architecture and Admin Device status remain owned by PFA-5.
Table and demo-data polish remain owned by PFA-6.
Final frontend closure remains owned by PFA-7.
```
