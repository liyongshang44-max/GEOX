<!-- docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-PRODUCTIZATION.md -->
# PFE-3 Customer Portal Productization

## 0. Phase

PFE-3 Customer Portal Productization / PFE-3 客户门户产品化.

PFE-3 follows PFE-0 inventory, PFE-1 page contracts, and PFE-2 Product Design System v1 primitives.

## 1. Goal

Customer Portal becomes a customer-safe, productized reporting surface using PFE-2 Product Design System primitives and PFE-1 page contracts.

中文：

Customer Portal 已按 PFE-1 页面契约和 PFE-2 产品设计系统，产品化为客户安全的报告门户。

## 2. Source baseline

```text
docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md
docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md
```

## 3. Covered routes

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

## 4. Non-goals

PFE-3 does not modify Operator Runtime Console, Admin Console, route topology, backend, migrations, contracts, fixtures, package files, workflow files, or external dependencies.

PFE-3 does not claim full accessibility certification, full responsive certification, visual regression, live runtime, or field pilot readiness.

## 5. Allowed files

PFE-3 may change Customer pages, Customer report pages, Customer export pages, the product stylesheet import, PFE-3 docs, and PFE-3 static acceptance.

Because `/customer/fields` currently resolves directly to `apps/web/src/views/CustomerFieldsIndexPage.tsx`, that Customer view is included as a narrow route-preserving exception. The route file remains unchanged.

## 6. Forbidden files

```text
apps/web/src/app/App.tsx
apps/web/src/app/routes/*
apps/web/src/features/operator/*
apps/web/src/features/admin/*
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/layouts/AdminLayout.tsx
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## 7. Customer-safe vocabulary

Allowed primary copy includes Report, Field, Operation, Summary, Status, Evidence summary, Updated at, Export, Unavailable, No data, Requires review, Authorized scope, and Delivery surface.

Forbidden primary copy includes command language, operator-only execution language, value-ledger language, memory-learning language, acceptance-console language, admin tooling language, and debug-first language.

## 8. Design system usage

PFE-3 uses PFE-2 primitives:

```text
ProductPageShell
ProductPageHeader
ProductSectionCard
ProductStatusBadge
ProductMetricTile
ProductDataTable
ProductEmptyState
ProductLoadingState
ProductErrorState
ProductStateBlock
ProductBoundaryBanner
ProductScopeBar
```

## 9. State requirements

Customer pages must provide safe loading, empty, unavailable, permission-limited, and error states where applicable.

## 10. Export and print requirements

Export routes are delivery surfaces. They show generated timestamps, customer-safe content, and delivery footer copy. They do not expose diagnostic tooling or mutation controls.

## 11. Acceptance

PFE-3 acceptance verifies docs, PFE-1/PFE-2 baselines, Product Design System usage, Customer route coverage, safe state coverage, export framing, forbidden source terms, and changed-file boundaries.

## 12. Completion statement

Customer Portal is productized as a customer-safe reporting surface using PFE-2 Product Design System primitives and PFE-1 page contracts.

中文：

Customer Portal 已按 PFE-1 页面契约和 PFE-2 产品设计系统，产品化为客户安全的报告门户。
