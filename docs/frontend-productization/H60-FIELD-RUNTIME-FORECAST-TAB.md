<!-- docs/frontend-productization/H60-FIELD-RUNTIME-FORECAST-TAB.md -->
# H60-F Field Runtime Forecast Tab
# H60-F Field Runtime 预测标签页

Status: H60-F FORECAST TAB  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Forecast / Read-only Forecast Panel Adapter  
Repo basis: main after H60-E merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  
Route topology impact: NONE  

---

## 0. Purpose

H60-F migrates Forecast tab only.

Canonical route is:

```text
/operator/fields/:fieldId/forecast
```

Legacy route remains:

```text
/operator/twin/fields/:fieldId/forecast
```

The source is the existing read-only forecast panel read model:

```text
source is existing read-only operator_field_twin_forecast_panel_v1
forecast window source is forecast_window_v1
```

H60-F reuses `fetchOperatorFieldTwinForecastPanel`.
H60-F does not create backend contract.
H60-F does not create a new backend endpoint.
H60-F does not change route topology.

---

## 1. Migrated content

H60-F migrates:

```text
Forecast
Forecast Window
Forecast Timeline
Forecast Evidence
Forecast Boundary
```

H60-F does not migrate:

```text
Scenario
Residual
Calibration
Health
Audit drawer
Replay Demo productization
Pilot Readiness
```

Scenario split remains H60-G.
Residual remains H60-H.
Calibration remains H60-I.
Health remains not_enabled / planned for H62.
Audit remains H60-K.

---

## 2. Data strategy

H60-F adds:

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeForecastAdapter.ts
```

The adapter reuses:

```text
fetchOperatorFieldTwinForecastPanel
```

It maps `operator_field_twin_forecast_panel_v1` and `forecast_window_v1` into a Field Runtime Forecast ViewModel.
It does not change backend response shape.
It does not add backend endpoints.
It does not write facts.
It does not create recommendation.
It does not compare scenarios.
It does not approve / dispatch / create AO-ACT.
It does not write ROI / Field Memory.

Allowed frontend work:

```text
rename
group
format
count
evidence refs dedupe
reason label mapping
time / horizon display
```

Forbidden frontend work:

```text
risk scoring
priority sorting
recommendation generation
scenario ranking
action generation
causal inference
new forecast generation
model calibration
```

---

## 3. Product language

Canonical Forecast tab product titles use:

```text
Forecast
Forecast Window
Forecast Timeline
Forecast Evidence
Forecast Boundary
```

Canonical main titles do not use:

```text
Operator Twin Forecast Panel
H22 Forecast Page
Forecast Risk Timeline
Risk Timeline
forecast_window_v1
raw forecast contract
Twin 工作区
```

`forecast_window_v1` is allowed only as a source label, contract detail, or audit source metadata.

Forecast is not recommendation.
Forecast window is not action window.
Forecast timeline is not task priority.
Forecast confidence is metadata, not action eligibility.

---

## 4. Boundary

H60-F shows the no-action boundary:

```text
No facts write
No recommendation creation
No scenario comparison
No approval
No dispatch
No AO-ACT task
No ROI write
No Field Memory write
No forecast generation
No backend contract change
```

H60-F does not write facts.
H60-F does not create recommendation.
H60-F does not compare scenarios.
H60-F does not approve / dispatch / create AO-ACT.
H60-F does not write ROI / Field Memory.
H60-F does not generate forecast.
H60-F does not create backend contract.

---

## 5. Route behavior

H60-F does not add routes.
H60-F does not change `App.tsx`.
H60-F does not change `operatorFieldRuntimeRoutes.tsx` route topology.
H60-F does not redirect legacy routes.
H60-F does not delete legacy routes.

Route behavior:

```text
/operator/fields/:fieldId/forecast        -> Field Runtime Forecast
/operator/twin/fields/:fieldId/forecast   -> legacy Operator Field Twin Forecast page
```

---

## 6. Acceptance

H60-F acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_FORECAST_TAB_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-E acceptance is phase-specific. H60-F acceptance checks that H60-E Evidence, H60-D Overview / State, H60-C layout/tabs, and H60-B route topology remain intact without reusing their changed-file allowlists.

---

## 7. Completion definition

H60-F complete means:

```text
/operator/fields/:fieldId/forecast shows real Field Runtime Forecast content
Forecast content is loaded from existing fetchOperatorFieldTwinForecastPanel
source is operator_field_twin_forecast_panel_v1
forecast window source is forecast_window_v1
Forecast Window is visible
Forecast Timeline is visible
Forecast Evidence refs are visible
Forecast Boundary is visible
legacy /operator/twin/fields/:fieldId/forecast remains available
H60-E Evidence remains intact
H60-D Overview / State remains intact
H60-C layout/tabs remain intact
Health remains not_enabled / planned for H62
no write surface is introduced
no scenario comparison is introduced
no new backend endpoint is introduced
H60-F acceptance passes
typecheck passes
build passes
```

H60-F does not mean:

```text
Scenario readonly split completed
Residual migrated
Calibration migrated
Runtime Health completed
Audit drawer completed
Replay Demo productization completed
Pilot Readiness completed
```
