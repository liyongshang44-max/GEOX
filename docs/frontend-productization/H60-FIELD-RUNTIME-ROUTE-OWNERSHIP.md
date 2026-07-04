<!-- docs/frontend-productization/H60-FIELD-RUNTIME-ROUTE-OWNERSHIP.md -->
# H60-B Field Runtime Route Ownership
# H60-B 地块运行视图路由所有权

Status: H60-B ROUTE OWNERSHIP  
Language: zh-CN  
Scope: Frontend Productization / Operator Field Runtime Routes / Read-only Placeholders  
Repo basis: main after H60-A merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  

---

## 0. Purpose

H60-B implements route ownership only.

H60-B does not implement Field Runtime Layout.
H60-B does not migrate field tab contents.
H60-B does not redirect legacy routes.
H60-B does not open write surfaces.
H60-B canonical routes render read-only placeholders.
H60-C will implement layout + tabs.

---

## 1. Canonical route family

Canonical Field Runtime routes:

```text
/operator/fields
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

The canonical family is mounted through a thin route module:

```text
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
```

`App.tsx` only mounts:

```text
<Route path="fields/*" element={<OperatorFieldRuntimeRoutes />} />
```

---

## 2. Legacy route family

Legacy routes remain preserved:

```text
/operator/twin/fields/:fieldId
/operator/twin/fields/:fieldId/forecast
/operator/twin/fields/:fieldId/scenarios
/operator/twin/fields/:fieldId/evidence
/operator/twin/fields/:fieldId/calibration
/operator/twin/fields/:fieldId/post-irrigation
/operator/twin/gateway-demo
```

H60-B does not redirect legacy routes.
H60-B does not delete old page imports.
H60-B does not migrate old page content.

---

## 3. Route ownership principles

```text
/operator/fields/* = canonical Field Runtime product route family
/operator/twin/fields/* = legacy Operator Twin field route family
route table owns page selection
layout only provides shell
page module owns route contents
```

`OperatorLayout` must not secretly replace route children by pathname.

---

## 4. Scenario submission isolation

Canonical route:

```text
/operator/fields/:fieldId/scenario
```

must remain:

```text
read-only scenario compare placeholder
projection review
not task
not recommendation
not approval
not dispatch
not AO-ACT
```

H60-B does not import `SubmitScenarioToRecommendationPanel` into canonical Field Runtime.

Legacy route:

```text
/operator/twin/fields/:fieldId/scenarios
```

remains reachable through the existing legacy page. Its governed-action notice is deferred to H60-G unless explicitly scoped earlier.

---

## 5. Runtime nonclaims

Every canonical placeholder displays:

```text
Field Runtime
Read-only Field Runtime
Runtime Mode: Replay-backed Demo
Live Device: Not connected
Production Gateway: Not online
Field Pilot: Not started
AO-ACT Dispatch: Disabled
Canonical route family: /operator/fields/*
Legacy route family preserved: /operator/twin/fields/*
```

---

## 6. No-write boundary

H60-B introduces no backend, DB, facts writer, AO-ACT task creation, dispatch, approval, ROI write, Field Memory write, model update, or recommendation submission from canonical routes.

The canonical placeholders do not load API data.

---

## 7. Acceptance

Primary H60-B acceptance command:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1.cjs
pnpm run typecheck:web
```

H58/H59/H60-A acceptance scripts are phase-specific static gates. H60-B acceptance checks that their protected route and shell boundaries remain intact without reusing their changed-file allowlists.

---

## 8. Completion definition

H60-B complete means:

```text
canonical /operator/fields/* routes exist
canonical routes render read-only placeholders
legacy /operator/twin/fields/* routes still exist
/operator/twin/gateway-demo still exists
route table owns page selection
OperatorLayout does not secretly replace route children
canonical scenario route is read-only
no write surface is introduced
H60-B route acceptance passes
```

H60-B does not mean:

```text
FieldRuntimeLayout completed
FieldRuntimeTabs completed
Overview migrated
Evidence migrated
Forecast migrated
Scenario split completed
Residual migrated
Calibration migrated
Health completed
Audit drawer completed
Replay Demo productization completed
Runtime Health completed
Pilot Readiness completed
```
