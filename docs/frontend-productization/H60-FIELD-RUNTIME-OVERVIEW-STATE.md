<!-- docs/frontend-productization/H60-FIELD-RUNTIME-OVERVIEW-STATE.md -->
# H60-D Field Runtime Overview / State Consolidation
# H60-D Field Runtime 总览与状态收口

Status: H60-D OVERVIEW / STATE CONSOLIDATION  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Overview / State / Read-only Workspace Adapter  
Repo basis: main after H60-C merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  
Route topology impact: NONE  

---

## 0. Purpose

H60-D migrates Overview / State only.

H60-D makes canonical routes show real workspace-derived read-only content:

```text
/operator/fields/:fieldId
/operator/fields/:fieldId/state
```

The source is the existing read-only Operator Field Twin workspace:

```text
source: operator_field_twin_workspace_v1
```

H60-D does not create a new backend contract and does not generate a new Field Runtime backend response.

---

## 1. Migrated content

H60-D migrates:

```text
Field Runtime Overview
State Summary
Evidence Summary
Coverage Summary
Data Gaps
Read-only Boundary
```

H60-D does not migrate:

```text
Full Evidence trace
Forecast
Scenario split
Residual
Calibration
Runtime Health
Audit drawer
H31-H45 chain as primary UI
```

Full Evidence trace remains H60-E.
Forecast remains H60-F.
Scenario split remains H60-G.
Residual remains H60-H.
Calibration remains H60-I.
Audit remains H60-K.

---

## 2. Data strategy

H60-D adds:

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeWorkspaceAdapter.ts
```

The adapter reuses:

```text
fetchOperatorFieldTwinWorkspace
```

It maps the existing workspace response to Field Runtime Overview and State ViewModels.
It does not change backend response shape.
It does not add backend endpoints.
It does not do business inference.
It does not generate state estimates.

Allowed frontend work:

```text
rename
group
format
display
presence / absence
count
coverage summary
gap summary
```

Forbidden frontend work:

```text
risk scoring
priority sorting
recommendation generation
causal inference
state estimation
forecast generation
calibration update
```

---

## 3. Route behavior

H60-D does not change `App.tsx`.
H60-D does not change `operatorFieldRuntimeRoutes.tsx` route topology.
H60-D does not redirect legacy routes.
H60-D does not delete legacy routes.

Legacy route remains preserved:

```text
/operator/twin/fields/:fieldId
```

Canonical route behavior:

```text
/operator/fields/:fieldId          -> Field Runtime Overview
/operator/fields/:fieldId/state    -> Field Runtime State
/operator/fields                   -> static list shell, no field-scoped tab links
```

The list route does not create `/operator/fields/not-selected/...` links in H60-D.

---

## 4. Boundary

H60-D shows the no-write boundary:

```text
No facts write
No recommendation creation
No approval
No dispatch
No AO-ACT task
No ROI write
No Field Memory write
```

H60-D does not introduce facts write.
H60-D does not introduce recommendation creation.
H60-D does not introduce approval / dispatch / AO-ACT.
H60-D does not introduce ROI / Field Memory write.
H60-D does not introduce model update.

---

## 5. Product language

Canonical Field Runtime main titles use:

```text
Field Runtime Overview
State Summary
Evidence Summary
Coverage Summary
Data Gaps
Read-only Boundary
```

Canonical main titles do not use:

```text
Twin 工作区
Operator Twin Workbench
H31-H45 决策到水分响应闭环
scenario_compare_v1
operator_field_twin_workspace_v1
```

`operator_field_twin_workspace_v1` is allowed only as source label / data-source detail / audit source metadata.

---

## 6. Acceptance

H60-D acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_OVERVIEW_STATE_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-C acceptance is phase-specific. H60-D acceptance checks that H60-C layout/tabs and H60-B route topology remain intact without reusing their changed-file allowlists.

---

## 7. Completion definition

H60-D complete means:

```text
/operator/fields/:fieldId shows real Field Runtime Overview content
/operator/fields/:fieldId/state shows real Field Runtime State content
content is derived from existing read-only Operator Field Twin workspace
State vector is visible in canonical Field Runtime
Evidence summary is visible in canonical Overview
Coverage summary is visible in canonical Overview
Data gaps summary is visible in canonical Overview
Read-only boundary is visible
legacy /operator/twin/fields/:fieldId remains available
H60-C layout/tabs remain intact
Health remains not_enabled / planned for H62
no write surface is introduced
no new backend endpoint is introduced
H60-D acceptance passes
typecheck passes
build passes
```

H60-D does not mean:

```text
Full Evidence trace migrated
Forecast migrated
Scenario readonly split completed
Residual migrated
Calibration migrated
Runtime Health completed
Audit drawer completed
Replay Demo productization completed
Pilot Readiness completed
```
