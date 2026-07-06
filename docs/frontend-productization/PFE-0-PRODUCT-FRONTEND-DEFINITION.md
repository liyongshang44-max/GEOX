<!-- docs/frontend-productization/PFE-0-PRODUCT-FRONTEND-DEFINITION.md -->
# PFE-0 Product Frontend Definition & Audit

## 0. Phase

```text
PFE-0 Product Frontend Definition & Audit
PFE-0 产品前端定义与审计
```

PFE-0 starts the Product Frontend Excellence line after the H67 / F0-A / F1 / F2 / F0-B frontend baseline has been frozen.

PFE-0 is not another H-line frontend expansion. PFE-0 is the first new product-frontend contract phase after F0-B.

## 1. Goal

PFE-0 defines the target acceptance shape for a Silicon-Valley-grade enterprise product frontend.

The target frontend is:

```text
role-separated
bilingual
accessible
responsive
visually coherent
regression-testable
demo-ready
boundary-safe
maintainable
```

A successful PFE-0 does not make the frontend visually final. It creates the route/page/surface inventory and quality contract that later PFE phases must close.

## 2. Non-goals

PFE-0 does not redesign pages.

PFE-0 does not modify React source.

PFE-0 does not modify route topology.

PFE-0 does not modify shell layout.

PFE-0 does not modify CSS.

PFE-0 does not implement accessibility fixes.

PFE-0 does not implement responsive fixes.

PFE-0 does not add visual regression tooling.

PFE-0 does not add Playwright.

PFE-0 does not add package dependencies.

PFE-0 does not touch backend, migrations, contracts, fixtures, or runtime acceptance.

PFE-0 does not claim live runtime, live device connection, production gateway online status, field pilot start, dispatch, AO-ACT execution, ROI write, Field Memory write, model learning, or autonomous operation.

## 3. Source-of-truth priority

PFE-0 must not define routes from memory.

PFE-0 audits the current repository route inventory and classifies each route or surface.

The source priority is:

```text
1. apps/web/src/app/App.tsx
2. apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
3. apps/web/src/app/routes/fieldsRoutes.tsx
4. apps/web/src/app/routes/customerOperationsRoutes.tsx
5. docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md
6. docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md
7. docs/frontend-productization/F0-B-FRONTEND-PRODUCTIZATION-FREEZE.md
```

If a later short-form task line omits a route already present in those files, PFE-0 must keep the repository fact and classify it instead of silently dropping it.

## 4. Surface classification vocabulary

Each route or surface must be assigned exactly one primary classification in the audit matrix.

```text
formal v1 page
formal sub-surface
export/print secondary surface
URL-only compatibility
future product-contract page
do-not-build page
```

### 4.1 formal v1 page

A formal v1 page is part of the product frontend surface for this product baseline.

It may still need quality work in later PFE phases, but it is not a future-only route.

### 4.2 formal sub-surface

A formal sub-surface is a field-scoped or detail-scoped product surface under a formal page family.

Field Runtime tabs are formal sub-surfaces.

### 4.3 export/print secondary surface

An export or print surface is user-visible but secondary.

It must be audited for customer-safe copy, no internal debugging leakage, printable layout, and route ownership.

It must not be omitted just because it is not a top-level navigation item.

### 4.4 URL-only compatibility

A URL-only compatibility route may remain reachable for legacy, debug, redirect, or internal compatibility reasons.

It must not be promoted into formal navigation unless a later product contract explicitly allows it.

### 4.5 future product-contract page

A future product-contract page is intentionally not implemented in the current product frontend baseline.

It cannot be built until a later phase defines owner, route ownership, data source, copy boundary, accessibility, responsive behavior, and acceptance.

### 4.6 do-not-build page

A do-not-build page is forbidden as a formal product surface because it would create false runtime, execution, production, or internal-governance claims.

## 5. Role-separated product surfaces

PFE-0 preserves the three role-separated surfaces frozen by the existing frontend baseline.

```text
Customer Portal
Operator Runtime Console
Admin Console
```

Each role surface has independent product expectations.

Customer Portal must be customer-safe and must not expose internal governance mechanics.

Operator Runtime Console must be technical enough for operators while preserving replay-backed and read-only runtime boundaries.

Admin Console must expose governance/readback surfaces without promoting debug, acceptance, or raw import surfaces into formal navigation.

## 6. Product frontend quality dimensions

Every formal route or surface must carry these audit dimensions in the PFE-0 matrix.

```text
owner
primary user
route
classification
current status
data source
allowed actions
forbidden actions
boundary/nonclaims
locale status
accessibility status
responsive status
empty/loading/error state status
screenshot/visual baseline status
release status
next PFE owner phase
```

These dimensions are not optional. Later PFE phases depend on them.

## 7. PFE phase handoff

PFE-0 hands off to the rest of the Product Frontend Excellence line.

```text
PFE-1 Page Contract Closure
PFE-2 Design System v1 Completion
PFE-3 Customer Portal Productization
PFE-4 Operator Runtime Console Productization
PFE-5 Admin Console Productization
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
PFE-8 Empty / Loading / Error State Completion
PFE-9 Visual Regression & Screenshot Baseline
PFE-10 Performance Budget & Bundle Hygiene
PFE-11 Product Copy / i18n Completion
PFE-12 Demo Mode & Release Candidate
PFE-13 Frontend Product v1 Freeze
```

## 8. Completion definition

PFE-0 is complete when:

```text
PFE-0 product frontend definition exists.
PFE-0 page audit matrix exists.
PFE-0 static acceptance exists.
The matrix includes Customer, Operator, and Admin surfaces.
The matrix includes Customer export secondary surfaces.
The matrix includes Operator Field Runtime sub-surfaces.
The matrix preserves URL-only compatibility classification.
The matrix preserves future product-contract classification.
The matrix preserves do-not-build classification.
The static acceptance proves PFE-0 did not modify frontend source, backend source, runtime source, contracts, fixtures, packages, or route topology.
typecheck:web passes.
build:web passes.
```

## 9. Accepted statement after PFE-0

After PFE-0, it is accurate to say:

```text
The current frontend route/page inventory has been audited, classified, and bounded for the Product Frontend Excellence line.
```

It is not accurate to say:

```text
The product frontend is now Silicon-Valley-grade.
The pages are visually final.
Accessibility is complete.
Responsive behavior is complete.
Visual regression is automated.
Runtime is live.
Field pilot can start.
```
