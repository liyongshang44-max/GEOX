<!-- docs/frontend-productization/F1-A-LOCALE-INFRASTRUCTURE-HARDENING.md -->
# F1-A Locale Infrastructure Hardening

## Phase

F1-A Locale Infrastructure Hardening follows F0-A Frontend Baseline Registers.

F1-A hardens locale infrastructure only. It does not translate formal product pages and does not connect locale controls to formal shells.

## Purpose

F1-A makes bilingual copy maintainable and testable before F1-B shell integration.

F1-A establishes:

```text
stable locale infrastructure
reusable LocaleToggle
product copy registry
product surface label registry
static acceptance gate
translation boundary documentation
```

## Allowed files

```text
apps/web/src/lib/locale.tsx
apps/web/src/lib/productCopy.ts
apps/web/src/lib/productSurfaceLabels.ts
apps/web/src/components/common/LocaleToggle.tsx
scripts/frontend_acceptance/ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1.cjs
docs/frontend-productization/F1-A-LOCALE-INFRASTRUCTURE-HARDENING.md
```

## Forbidden files

```text
apps/web/src/app/App.tsx
apps/web/src/app/routes/
apps/web/src/layouts/
apps/web/src/features/
apps/web/src/views/
apps/web/src/styles/
apps/server/
migrations/
packages/contracts/
fixtures/
.github/
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## Existing locale skeleton

F1-A preserves the existing locale contract:

```text
LocaleCode includes zh-CN and en-US.
LOCALE_STORAGE_KEY remains geox.locale.
LocaleProvider remains exported.
useLocale remains exported.
setLocale(next) remains available.
text(zh, en) remains available for backward compatibility.
```

## New infrastructure

F1-A adds these locale helpers:

```text
LocalizedCopy
LOCALE_STORAGE_KEY
SUPPORTED_LOCALES
isLocaleCode
normalizeLocale
localizedText
```

`LocalizedCopy` uses `zh` and `en` fields for registry ergonomics.
`LocaleCode` remains `zh-CN` and `en-US` for browser and provider state.

## LocaleToggle contract

`LocaleToggle` is a local-only UI component.

It must:

```text
show current locale
switch zh-CN / en-US
use useLocale().setLocale
avoid page reload
avoid backend calls
persist through geox.locale via LocaleProvider
provide aria-label
remain available for Customer / Operator / Admin shells later
```

F1-A does not wire LocaleToggle into CustomerLayout, OperatorLayout, or AdminLayout.

## Product copy registry contract

`productCopy.ts` stores governed bilingual static product copy for formal product surfaces.

Allowed copy categories:

```text
formal nav labels
shell title
shell subtitle
boundary copy
nonclaim copy
empty state copy
loading state copy
error state copy
static product surface labels
static helper text
```

`productCopy.ts` must not use `text(`. Consumers should select locale through locale helpers when F1-B/F1-C/F1-D integrate the registry.

## Product surface labels registry contract

`productSurfaceLabels.ts` defines stable product surface IDs and bilingual display labels.

It does not define navigation behavior, permissions, backend capability, runtime state, execution capability, or dispatch state.

## Translation boundary

### Do translate later

```text
formal nav labels
shell title
shell subtitle
boundary copy
nonclaim copy
empty state copy
loading state copy
error state copy
static product surface labels
static helper text
```

### Do not translate

```text
fact_id
field_id
source_ref
evidence_ref
raw_payload
contract kind
route path
API field name
backend-returned domain object value
audit hash
determinism hash
decision_cycle_id
tenant_id
project_id
group_id
device_id
runtime source identifiers
```

Evidence, source identifiers, route paths, hashes, and backend-returned object values are part of traceability and must not be localized as UI prose.

## Nonclaims

Locale infrastructure hardening does not change runtime semantics.
Locale infrastructure hardening does not change backend API.
Locale infrastructure hardening does not change route topology.
Locale infrastructure hardening does not translate evidence identifiers.
Locale infrastructure hardening does not convert replay-backed demo into live production.
Locale infrastructure hardening does not claim live device connection.
Locale infrastructure hardening does not claim production gateway online.
Locale infrastructure hardening does not enable AO-ACT dispatch.
Locale infrastructure hardening does not compute ROI.
Locale infrastructure hardening does not write Field Memory.

## Acceptance

```text
node scripts/frontend_acceptance/ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

Acceptance is static repo read-only. It does not start the app, call backend, call DB, write facts, or mutate source.

## Next phase

F1-A prepares F1-B Shell / Navigation Bilingual Integration.

F1-A completion does not mean:

```text
the frontend is bilingual
Customer Portal is bilingual
Operator Runtime Console is bilingual
Admin Console is bilingual
all pages are translated
locale is fully integrated into shells
```

F1-A completion means:

```text
Locale infrastructure is hardened.
A reusable language toggle exists.
Governed bilingual copy registries exist.
The project is ready for F1-B Shell / Navigation Bilingual Integration.
```
