<!-- docs/frontend-productization/H60-FIELD-RUNTIME-LAYOUT-TABS.md -->
# H60-C Field Runtime Layout + Tabs
# H60-C 地块运行视图壳层与标签系统

Status: H60-C LAYOUT AND TABS  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Layout / Tabs / Boundary Banner / Static ViewModel  
Repo basis: main after H60-B merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  
App.tsx impact: NONE  

---

## 0. Purpose

H60-C implements Field Runtime layout and tabs only.

H60-C does not migrate business content.
H60-C does not load API data.
H60-C does not change App.tsx route topology.
H60-C does not redirect legacy routes.
H60-C does not open write surfaces.
H60-D through H60-K will migrate concrete tab content.

---

## 1. Component ownership

H60-C introduces the shared canonical Field Runtime shell:

```text
apps/web/src/features/operator/fieldRuntime/runtimeNonclaims.ts
apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts
apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx
apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabStub.tsx
apps/web/src/styles/operatorFieldRuntime.css
```

`operatorFieldRuntimeRoutes.tsx` remains the route owner and now renders `FieldRuntimeRoutePage`.

---

## 2. ViewModel contract

H60-C ViewModel is static and local:

```text
FieldRuntimeViewModel
FieldRuntimeTabKey
FieldRuntimeRouteKey
FieldRuntimeTabStatus
buildFieldRuntimeViewModel(routeKey, fieldId)
```

The ViewModel does not load backend data.

---

## 3. Tab status model

Tabs are fixed:

```text
Overview
Evidence
State
Forecast
Scenario
Residual
Calibration
Health
Audit
```

Status values are:

```text
available
limited
not_enabled
```

H60-C status assignment:

```text
Overview: limited
Evidence: limited
State: limited
Forecast: limited
Scenario: limited
Residual: limited
Calibration: limited
Health: not_enabled / planned for H62
Audit: limited
```

These states are not business risk colors.

---

## 4. Runtime nonclaims

Field Runtime displays:

```text
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
Read-only Field Runtime
```

It also displays:

```text
Canonical route family: /operator/fields/*
Legacy route family preserved: /operator/twin/fields/*
```

---

## 5. No-write boundary

H60-C introduces no facts writer, AO-ACT task creation, dispatch, approval, ROI write, Field Memory write, model update, recommendation submission, backend API fetch, POST, `/api/control`, or `/api/control/ao_act` behavior.

Boundary wording may mention recommendation, dispatch, AO-ACT, ROI, and Field Memory only as explicit nonclaims.

---

## 6. Styling boundary

H60-B placeholder inline styles are not the Field Runtime product shell.

H60-C moves the canonical Field Runtime main interface into:

```text
apps/web/src/styles/operatorFieldRuntime.css
```

H60-C components use class names for layout, banner, tabs, and stubs.

---

## 7. Acceptance

H60-C acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_LAYOUT_TABS_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-B acceptance is phase-specific. H60-C acceptance checks that the H60-B route topology remains intact without reusing the H60-B changed-file allowlist.

---

## 8. Completion definition

H60-C complete means:

```text
canonical /operator/fields/* routes render FieldRuntimeRoutePage
FieldRuntimeLayout exists
FieldRuntimeTabs exists
FieldRuntimeBoundaryBanner exists
FieldRuntimeTabStub exists
fieldRuntimeViewModel exists
runtimeNonclaims exists
operatorFieldRuntime.css exists
all tabs render in the same product shell
runtime nonclaims are visible
tab statuses are visible
health is not_enabled / planned for H62
legacy /operator/twin/fields/* routes remain preserved
no write surface is introduced
no API data is loaded
H60-C acceptance passes
typecheck passes
```

H60-C does not mean:

```text
Overview migrated
Evidence migrated
Forecast migrated
Scenario readonly split completed
Residual migrated
Calibration migrated
Health completed
Audit drawer completed
Replay Demo productization completed
Runtime Health completed
Pilot Readiness completed
```
