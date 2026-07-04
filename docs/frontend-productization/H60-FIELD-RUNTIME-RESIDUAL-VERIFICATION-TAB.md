<!-- docs/frontend-productization/H60-FIELD-RUNTIME-RESIDUAL-VERIFICATION-TAB.md -->
# H60-H Field Runtime Residual / Verification Tab

Status: H60-H RESIDUAL VERIFICATION TAB  
Scope: Frontend Productization / Field Runtime Residual / Read-only Post-Irrigation Verification Adapter  
Repo basis: main after H60-G merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  
Route topology impact: NONE  

## Purpose

H60-H migrates Residual / Verification tab only.

Canonical route is:

```text
/operator/fields/:fieldId/residual
```

Legacy route remains:

```text
/operator/twin/fields/:fieldId/post-irrigation
```

The source is existing read-only `operator_field_twin_post_irrigation_verification_v1`.
The closure source is `operator_twin_h31_h45_closure_v1`.

H60-H reuses `fetchOperatorFieldTwinPostIrrigationVerification`.
H60-H reuses `fetchOperatorTwinH31H45Closure`.
H60-H does not create backend contract.
H60-H does not create a new backend endpoint.
H60-H does not change route topology.

## Migrated content

H60-H migrates:

```text
Residual / Verification
Response Verification
Pre/Post State
Response Delta
Execution Evidence
Zone Response
Verification Gaps
Execution Tail Summary
Residual Boundary
```

H60-H does not migrate Calibration / Health / Audit.
Calibration remains H60-I.
Health remains not_enabled / planned for H62.
Audit remains H60-K.

## Data strategy

H60-H adds:

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeResidualAdapter.ts
```

The adapter maps `operator_field_twin_post_irrigation_verification_v1` and `operator_twin_h31_h45_closure_v1` into a Field Runtime Residual / Verification ViewModel.

H60-H does not write facts.
H60-H does not create recommendation.
H60-H does not approve / dispatch / create AO-ACT.
H60-H does not write ROI.
H60-H does not write Field Memory.
H60-H does not claim causal proof.

## Product language

Canonical product titles use:

```text
Residual / Verification
Response Verification
Pre/Post State
Response Delta
Execution Evidence
Zone Response
Verification Gaps
Residual Boundary
```

Contract names are allowed only as source label, contract detail, or audit/source metadata.

Residual is not causal proof.
Response verification is not ROI.
Response verification is not Field Memory.
Downstream candidate flags are metadata only.
Write-ready flags are metadata only.
Execution tail summary is not Audit drawer.

## Boundary

H60-H shows the no-write boundary:

```text
No facts write
No recommendation creation
No approval
No dispatch
No AO-ACT task
No ROI write
No Field Memory write
No causal proof claim
No operation plan creation
No backend contract change
```

## Route behavior

H60-H does not add routes.
H60-H does not change `App.tsx`.
H60-H does not change `operatorFieldRuntimeRoutes.tsx` route topology.
H60-H does not redirect legacy routes.
H60-H does not delete legacy routes.

Route behavior:

```text
/operator/fields/:fieldId/residual                  -> Field Runtime Residual / Verification
/operator/twin/fields/:fieldId/post-irrigation      -> legacy Operator Field Twin Post-Irrigation page
```

## Acceptance

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_RESIDUAL_VERIFICATION_TAB_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-G acceptance is phase-specific. H60-H acceptance checks that H60-G Scenario, H60-F Forecast, H60-E Evidence, H60-D Overview / State, H60-C layout/tabs, and H60-B route topology remain intact without reusing older changed-file allowlists.

## Completion definition

H60-H complete means:

```text
/operator/fields/:fieldId/residual shows real Field Runtime Residual / Verification content
Residual content is loaded from existing fetchOperatorFieldTwinPostIrrigationVerification
H31-H45 closure content is loaded from existing fetchOperatorTwinH31H45Closure
source is operator_field_twin_post_irrigation_verification_v1
closure source is operator_twin_h31_h45_closure_v1
Verification Summary is visible
Pre/Post State Compare is visible
Response Delta is visible
Execution Evidence is visible
Zone Response is visible
Verification Gaps are visible
Execution Tail Summary is visible
Residual Boundary is visible
Downstream candidate flags are metadata only
legacy /operator/twin/fields/:fieldId/post-irrigation remains available
H60-G Scenario remains intact
H60-F Forecast remains intact
H60-E Evidence remains intact
H60-D Overview / State remains intact
H60-C layout/tabs remain intact
Health remains not_enabled / planned for H62
no write surface is introduced in canonical Field Runtime
no new backend endpoint is introduced
no causal proof claim is introduced
H60-H acceptance passes
typecheck passes
build passes
```

H60-H does not mean:

```text
Calibration migrated
Runtime Health completed
Audit drawer completed
Replay Demo productization completed
Pilot Readiness completed
ROI completed
Field Memory completed
```
