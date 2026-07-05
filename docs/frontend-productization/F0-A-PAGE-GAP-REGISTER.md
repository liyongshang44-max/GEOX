<!-- docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md -->
# F0-A Page Gap Register

## Purpose

Page Gap Register records which frontend pages are release surfaces, which reachable routes remain incomplete, which pages are future product-contract pages, and which pages must not be built as formal product surfaces.

This register is not an implementation plan, not a page repair task, and not a route migration plan.

## A. Release surfaces present

### Customer Portal

Release surfaces present:

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

Customer surfaces are customer-facing report / portal surfaces. They are not internal runtime, dispatch, AO-ACT, ROI, or Field Memory surfaces.

### Admin Console

Release surfaces present:

```text
/admin/dashboard
/admin/fields
/admin/operations
/admin/devices
/admin/evidence
/admin/healthz
/admin/skills
```

Admin surfaces are internal governance/readback surfaces. Admin alerts, acceptance, import, and debug compatibility routes remain non-formal unless separately productized.

### Operator Runtime Console

Release surfaces present:

```text
/operator/twin
/operator/twin/gateway-demo
/operator/pilot
/operator/fields/:fieldId
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/state
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
```

Operator surfaces are read-only runtime review surfaces. They do not create facts, dispatch tasks, create AO-ACT records, write ROI, or write Field Memory.

## B. Route exists but product page incomplete

### Operator Fields Index

```text
Page: Operator Fields Index
Current route: /operator/fields
Status: route exists, product page incomplete
Current behavior: field runtime route family exists, but formal field list / selector is not productized
Blocking F0-A: no
Future task: separate frontend page productization only if runtime/frontend priority allows
```

Important classification: `/operator/fields` is part of the formal Operator Runtime Console route family, but the current index behavior is still incomplete as a product page.

### Operator Pilot explicit route ownership cleanup

```text
Page: Operator Pilot Readiness
Current route: /operator/pilot
Status: reachable, but route ownership needs explicit cleanup
Issue: should be owned by route table, not layout-level pathname interception
Blocking F0-A: no
Future task: route ownership cleanup before strict frontend freeze if required
```

### Admin Health route naming

```text
Page: Admin Runtime Health
Current route: /admin/healthz
Status: release surface exists, naming remains technical
Issue: future route may become /admin/health
Blocking F0-A: no
Future task: route normalization only after route ownership decision
```

### Admin Config route naming

```text
Page: Admin Config
Current route: /admin/skills
Status: label normalized as Config, route still /admin/skills
Issue: future route may become /admin/config
Blocking F0-A: no
Future task: route normalization only after config route decision
```

## C. Future product-contract pages

### Operator Evidence Overview

```text
Target route: /operator/evidence
Current status: future product page
Current substitute: field-scoped evidence tab and preserved legacy evidence routes
Blocking F0-A: no
Do not build until: operator-level evidence overview contract exists
```

### Operator Runtime Health Overview

```text
Target route: /operator/health
Current status: future product page
Current substitute: field-scoped /operator/fields/:fieldId/health
Blocking F0-A: no
Do not build until: aggregate runtime health read model or Runtime Health Service Gate exists
```

### Operator Settings

```text
Target route: /operator/settings
Current status: future product page
Blocking F0-A: no
Do not build until: read-only operator settings contract exists
```

### Customer Evidence Summary

```text
Target route: /customer/evidence-summary
Current status: future product page
Blocking F0-A: no
Do not build until: customer-safe evidence summary contract exists
```

### Admin Tenants

```text
Target route: /admin/tenants
Current status: future product page
Blocking F0-A: no
Do not build until: tenant governance contract exists
```

### Admin Imports

```text
Target route: /admin/imports
Current status: future product page
Current compatibility route: /admin/import redirect or URL-only compatibility path
Blocking F0-A: no
Do not build until: import/source governance contract exists
```

### Admin Audit

```text
Target route: /admin/audit
Current status: future product page
Current substitute: /admin/evidence and URL-only acceptance/debug routes
Blocking F0-A: no
Do not build until: admin audit product contract exists
```

## D. Do-not-build pages

Do-not-build pages for formal product surfaces:

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

F0-A records these as prohibited formal product surfaces. It does not create replacement pages.
