<!-- docs/frontend-productization/H60-FIELD-RUNTIME-SCENARIO-READONLY-SPLIT.md -->
# H60-G Field Runtime Scenario Read-only Split
# H60-G Field Runtime 情景只读拆分

Status: H60-G SCENARIO READ-ONLY SPLIT  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Scenario / Read-only Scenario Compare Adapter / Legacy Governed Notice  
Repo basis: main after H60-F merge  
Write impact: NONE in canonical Field Runtime  
Backend impact: NONE  
DB impact: NONE  
Route topology impact: NONE  

---

## 0. Purpose

H60-G migrates Scenario tab only.

Canonical route is:

```text
/operator/fields/:fieldId/scenario
```

Legacy route remains:

```text
/operator/twin/fields/:fieldId/scenarios
```

Canonical Scenario is read-only.
Legacy Scenario may retain SubmitScenarioToRecommendationPanel.
Legacy scenario submission remains isolated.

The source is the existing read-only scenario compare read model:

```text
source is existing read-only operator_field_twin_scenario_compare_v1
scenario source is scenario_compare_v1
```

H60-G reuses `fetchOperatorFieldTwinScenarioCompare`.
H60-G does not create backend contract.
H60-G does not create a new backend endpoint.
H60-G does not change route topology.

---

## 1. Split rule

Canonical Field Runtime route:

```text
/operator/fields/:fieldId/scenario
```

This route is read-only Scenario Review.
It displays scenario status, no-action baseline status, options, comparison metadata, evidence refs, and boundary copy.

Legacy Operator Twin route:

```text
/operator/twin/fields/:fieldId/scenarios
```

This route remains the legacy / governed action surface.
It may retain SubmitScenarioToRecommendationPanel.
It is not canonical Field Runtime.
It does not approve, dispatch, create AO-ACT, or create operation plan.

---

## 2. Migrated content

H60-G migrates into canonical Field Runtime:

```text
Scenario
Scenario Review
Scenario Status
Scenario Options
No-action Baseline
Scenario Evidence
Scenario Boundary
```

H60-G does not migrate:

```text
Residual
Calibration
Health
Audit drawer
Replay Demo productization
Pilot Readiness
```

Residual remains H60-H.
Calibration remains H60-I.
Health remains not_enabled / planned for H62.
Audit remains H60-K.

---

## 3. Data strategy

H60-G adds:

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeScenarioAdapter.ts
```

The adapter reuses:

```text
fetchOperatorFieldTwinScenarioCompare
```

It maps `operator_field_twin_scenario_compare_v1` and `scenario_compare_v1` into a Field Runtime Scenario ViewModel.
It does not change backend response shape.
It does not add backend endpoints.
It does not write facts.
It does not create recommendation in canonical route.
It does not approve / dispatch / create AO-ACT.
It does not create operation plan.
It does not write ROI / Field Memory.

H60-G does not import SubmitScenarioToRecommendationPanel into canonical Field Runtime.
H60-G does not call submitOperatorScenarioRecommendation from canonical Field Runtime.

Allowed frontend work:

```text
rename
group
format
count
evidence refs dedupe
reason label mapping
option display formatting
no-action baseline identification
```

Forbidden frontend work in canonical Field Runtime:

```text
scenario ranking
scenario recommendation
priority sorting
risk scoring
best option selection
action generation
causal inference
model calibration
```

---

## 4. Product language

Canonical Scenario tab product titles use:

```text
Scenario
Scenario Review
Scenario Options
No-action Baseline
Scenario Evidence
Scenario Boundary
```

Canonical main titles do not use:

```text
Scenario Compare Submission
Submit Scenario
Scenario → Recommendation
Operator Twin Scenario Compare
H23 Scenario Page
scenario_compare_v1
raw scenario contract
Twin 工作区
Best Scenario
Recommended Scenario
Priority Scenario
Risk Ranking
```

`scenario_compare_v1` is allowed only as a source label, contract detail, or audit source metadata.

Scenario is not recommendation.
Scenario options are not ranked.
Scenario option confidence is metadata, not action eligibility.
Scenario delta is displayed as comparison metadata, not task priority.
Legacy scenario submission remains isolated.

---

## 5. Boundary

H60-G canonical Scenario shows the no-submission boundary:

```text
No facts write
No recommendation creation
No scenario submission
No approval
No dispatch
No AO-ACT task
No operation plan creation
No ROI write
No Field Memory write
No backend contract change
```

H60-G does not write facts.
H60-G does not create recommendation in canonical route.
H60-G does not approve / dispatch / create AO-ACT.
H60-G does not create operation plan.
H60-G does not write ROI / Field Memory.
H60-G does not create backend contract.

---

## 6. Route behavior

H60-G does not add routes.
H60-G does not change `App.tsx`.
H60-G does not change `operatorFieldRuntimeRoutes.tsx` route topology.
H60-G does not redirect legacy routes.
H60-G does not delete legacy routes.

Route behavior:

```text
/operator/fields/:fieldId/scenario        -> Field Runtime Scenario Review
/operator/twin/fields/:fieldId/scenarios  -> legacy / governed action surface
```

---

## 7. Acceptance

H60-G acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_SCENARIO_READONLY_SPLIT_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-F acceptance is phase-specific. H60-G acceptance checks that H60-F Forecast, H60-E Evidence, H60-D Overview / State, H60-C layout/tabs, and H60-B route topology remain intact without reusing their changed-file allowlists.

---

## 8. Completion definition

H60-G complete means:

```text
/operator/fields/:fieldId/scenario shows real Field Runtime Scenario Review content
Scenario content is loaded from existing fetchOperatorFieldTwinScenarioCompare
source is operator_field_twin_scenario_compare_v1
scenario source is scenario_compare_v1
Scenario Status is visible
No-action Baseline status is visible
Scenario Options are visible
Scenario Evidence refs are visible
Scenario Boundary is visible
canonical route contains no SubmitScenarioToRecommendationPanel
canonical route does not call submitOperatorScenarioRecommendation
canonical route contains no input/select/textarea/button for submission
legacy /operator/twin/fields/:fieldId/scenarios remains available
legacy route is clearly marked as legacy / governed action surface
H60-F Forecast remains intact
H60-E Evidence remains intact
H60-D Overview / State remains intact
H60-C layout/tabs remain intact
Health remains not_enabled / planned for H62
no write surface is introduced in canonical Field Runtime
no new backend endpoint is introduced
H60-G acceptance passes
typecheck passes
build passes
```

H60-G does not mean:

```text
Residual migrated
Calibration migrated
Runtime Health completed
Audit drawer completed
Replay Demo productization completed
Pilot Readiness completed
```
