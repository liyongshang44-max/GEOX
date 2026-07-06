<!-- docs/frontend-productization/PFE-11-PRODUCT-COPY-I18N-COMPLETION.md -->
# PFE-11 Product Copy / i18n Completion

## 0. Phase

PFE-11 Product Copy / i18n Completion.

PFE-11 establishes a role-safe bilingual product-copy and i18n baseline for Formal Product Frontend v1. It is not a globalization program, marketing rewrite, machine translation project, full locale framework migration, or multi-language market launch.

## 1. Completion statement

Formal Customer, Operator, and Admin product surfaces have a role-safe bilingual product-copy and i18n baseline.

Chinese completion statement:

```text
Customer、Operator、Admin 正式产品面已经建立角色安全、双语一致、集中可审查的产品文案与 i18n 基线。
```

## 2. Source baseline

PFE-11 follows:

```text
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
PFE-8 Empty / Loading / Error State Completion
PFE-9 Visual Regression & Screenshot Baseline
PFE-10 Performance Budget & Bundle Hygiene
```

The current app already has `LocaleProvider`, `useLocale`, `localizedText`, `LocaleToggle`, and `productSurfaceLabels.ts`. PFE-11 uses those lightweight primitives and does not introduce a third-party i18n framework.

## 3. Covered surfaces

Customer:

```text
/customer/dashboard
/customer/fields
/customer/fields/:fieldId
/customer/fields/:fieldId/export
/customer/operations
/customer/operations/:operationId
/customer/operations/:operationId/export
/customer/reports
/customer/export
```

Operator:

```text
/operator/twin
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/state
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
/operator/twin/gateway-demo
/operator/pilot
```

Admin:

```text
/admin/dashboard
/admin/fields
/admin/operations
/admin/devices
/admin/evidence
/admin/skills
/admin/healthz
```

Supporting:

```text
/login
LocaleToggle
Product state primitives
ProductDataTable
ProductPageShell / ProductPageHeader
ProductBoundaryBanner
ProductStatusBadge
ProductScopeBar
RuntimeTextGuard
export / print surfaces
```

## 4. Copy taxonomy

PFE-11 fixes the formal copy taxonomy:

```text
shell
navigation
pageTitle
pageLead
sectionTitle
sectionDescription
tableColumn
emptyState
loadingState
errorState
unavailableState
boundary
nonclaim
status
metricLabel
actionLabel
safeNextAction
formLabel
ariaLabel
exportPrint
compatibilityUrlOnly
```

Each formal copy entry must have a surface owner, a copy kind, zh-CN copy, en-US copy, and a clear role boundary.

## 5. Locale policy

PFE-11 v1 supports only:

```text
zh-CN
en-US
```

`localizedText` must select English for `en-US` and Chinese otherwise. `LocaleToggle` must keep using LocaleProvider state and must not change navigation.

## 6. Surface copy policy

Customer copy uses report and authorized-scope language. It must not expose internal implementation vocabulary or imply write, control, approval, or dispatch ability.

Operator copy uses runtime review and source readback language. It may use source, replay, adapter, residual, calibration, and readback vocabulary, but it must preserve read-only and non-execution boundaries.

Admin copy uses governance and readback language. It must not turn Admin into an operations or service-control console.

## 7. RuntimeTextGuard policy

RuntimeTextGuard is fallback only. It must not grow as the primary copy or i18n mechanism. PFE-11 acceptance records the current replacement count and fails if it increases without a documented issue-register reason.

Formal product copy should be solved in source, view model, or copy catalog layers rather than by DOM text rewriting.

## 8. Hardcoded visible copy policy

PFE-11 does not ban all string literals. Route paths, CSS classes, data attributes, enum values, source ids, test ids, trace ids, and table values are not automatically visible product copy.

PFE-11 scans formal visible-copy source with scoped rules. High-risk customer internal terms, operator execution claims, and admin service-operation claims are blocked by scope rather than by global grep.

## 9. Non-goals

PFE-11 does not add routes, remove routes, add product capability, change backend behavior, change migrations, change contracts, change fixtures, change package files, add i18n dependencies, introduce i18next or react-intl, perform machine translation, perform marketing copy rewrite, complete all locale formatting, or redo PFE-6 through PFE-10.

## 10. Allowed files

```text
docs/frontend-productization/PFE-11-PRODUCT-COPY-I18N-COMPLETION.md
docs/frontend-productization/PFE-11-COPY-MATRIX.md
docs/frontend-productization/PFE-11-I18N-COVERAGE-MATRIX.md
docs/frontend-productization/PFE-11-COPY-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_11_PRODUCT_COPY_I18N_COMPLETION.cjs
apps/web/src/lib/locale.tsx
apps/web/src/lib/productSurfaceLabels.ts
apps/web/src/components/common/LocaleToggle.tsx
apps/web/src/components/common/RuntimeTextGuard.tsx
apps/web/src/layouts/CustomerLayout.tsx
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/layouts/AdminLayout.tsx
apps/web/src/views/LoginPage.tsx
apps/web/src/design-system/product/*
```

Page files are allowed only when the matrix or gate exposes a concrete formal visible-copy gap.

## 11. Forbidden files

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
apps/web/dist/*
docs/audit/*.png
docs/audit/**/*.png
```

## 12. Acceptance policy

PFE-11 acceptance is static. It does not start DB, does not start web, does not write facts, and does not require dist. It checks docs, locale primitives, copy catalog coverage, LocaleToggle accessibility copy, RuntimeTextGuard replacement count, scoped role-boundary terms, and no forbidden file classes.

## 13. Completion boundary

PFE-11 can claim role-safe zh-CN/en-US copy and i18n baseline. It cannot claim all-language localization, translation certification, international market launch, automated translation, full i18n framework migration, or full date/number/currency localization.
