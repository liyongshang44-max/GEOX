# R3 Forecast Calibration & Residual Loop

## Phase

R3 Forecast Calibration & Residual Loop / R3 预测校准与残差闭环.

## Purpose

R3 defines the contract-first forecast calibration readiness layer after R2.

The required loop is:

```text
forecast -> later evidence -> residual -> error bucket -> calibration review packet -> replay
```

R3 defines forecast object, forecast horizon, verification window, post-event evidence relation, residual calculation, error bucket, calibration review packet, forecast replay equivalence, forecast/read model, versioning, and R4 handoff.

R3 does not implement runtime forecast service, execution, field operation control, model parameter mutation, or business value accounting.

## Preconditions

R2 Online State Estimation Loop is complete.

R3 consumes state estimates from R2:

```text
state estimate object
state vector
state confidence / uncertainty
state freshness
state read model
state_replay_equivalence_hash
base_state_estimate_ref
```

R3 consumes state estimates from R2. A forecast without `base_state_estimate_ref` and `state_replay_equivalence_hash` is not reviewable under R3.

## Non-goals

R3 has no automatic recommendation. R3 has no dispatch. R3 has no AO-ACT. R3 has no ROI. R3 has no Field Memory. R3 has no model auto-update. R3 has no prescription. R3 has no field pilot execution. R3 has no autonomous operation.

R3 does not add recommendation writer, dispatch writer, AO-ACT task creator, ROI ledger writer, Field Memory writer, automatic model updater, automatic calibration applier, or prescription generator.

R3 may say forecast was compared with later evidence, residual was calculated, and calibration review is required / available.

## R2 Dependency

R3 depends on R2 Online State Estimation Loop.

R3 consumes state estimates from R2 through `base_state_estimate_ref`, `state_replay_equivalence_hash`, state confidence / uncertainty, state freshness, and state read model.

Post-event evidence can verify a forecast, but the forecast base must remain the R2 state estimate relation.

## Forecast Object

R3 defines Forecast Object.

Required fields:

```text
forecast_id
tenant_id
project_id
subject_ref
forecast_kind
forecast_mode
issued_at
base_state_estimate_ref
horizon
forecast_vector
confidence
uncertainty
assumptions
input_evidence_refs
verification
replay
nonclaims
```

Minimum forecast kind:

```text
field_runtime_forecast
```

Future forecast kinds may include:

```text
soil_moisture_forecast
crop_stress_forecast
weather_exposure_forecast
operation_window_forecast
device_observation_forecast
```

Forecast mode values:

```text
replay_backed
offline_candidate
online_candidate
online_verified
```

Only a separately scoped implementation can promote a mode into online verification. This R3 readiness PR is contract-only.

## Forecast Vector

Forecast vector is a prediction about future state.

Forecast vector principles:

```text
forecast_vector is a prediction about future state.
forecast_vector must reference base_state_estimate_ref.
forecast_vector must include confidence / uncertainty.
forecast_vector must not include recommendation, action, dispatch, ROI, or Field Memory.
```

Minimum forecast_vector terms:

```text
water_state_forecast
temperature_state_forecast
coverage_state_forecast
target_time
unknown
dry_candidate
normal_candidate
wet_candidate
cold_candidate
hot_candidate
insufficient
partial
sufficient
confidence
```

`dry_candidate` does not mean irrigate. `wet_candidate` does not mean stop irrigation. `hot_candidate` does not mean intervene. Forecast values are not actions.

Forbidden forecast_vector fields:

```text
recommendation
suggestion
action
dispatch
AO-ACT
ROI
yield impact
profit impact
Field Memory
prescription
priority
severity
next action
automatic update
```

## Forecast Horizon

R3 defines forecast horizon.

Required horizon fields:

```text
horizon.start
horizon.end
horizon_ms
target_times
forecast_granularity
```

Recommended horizon types:

```text
short_horizon
medium_horizon
long_horizon
```

Minimum horizon:

```text
short_horizon: 1h / 6h / 24h depending on available evidence cadence
contract-defined horizon, not live forecast engine
```

A defined forecast horizon is not a claim that a live forecast service is running.

## Verification Window

A forecast is not reviewable unless later evidence can be matched to the forecast target horizon.

Verification window fields:

```text
verification_window.start
verification_window.end
target_time
allowed_early_ms
allowed_late_ms
required_evidence_kinds
minimum_coverage_ratio
verification_as_of
```

Verification status values:

```text
pending
verifiable
verified
not_verifiable
expired
invalid
```

Verification status does not create recommendation, dispatch, model update, ROI, or Field Memory.

## Post-event Evidence

Post-event evidence must have stable source identity, stable subject identity, valid timestamp semantics, fall inside verification window, and be accepted evidence, not fabricated evidence.

Post-event evidence fields:

```text
post_event_evidence_refs
post_event_state_estimate_refs
verification_evidence_window
verification_evidence_coverage
excluded_post_event_evidence_refs
exclusion_reasons
```

Exclusion reasons:

```text
outside_verification_window
invalid_timestamp
missing_subject_identity
unrecognized_source
insufficient_coverage
duplicate_evidence
not_state_eligible
raw_debug_payload
```

## Residual Calculation

Residual is the difference between forecasted value and later observed or estimated value for the same subject and target time/window.

Residual fields:

```text
residual_id
forecast_id
subject_ref
target_time
verification_window
forecast_value
observed_value
residual_value
residual_kind
residual_magnitude
calculation_method
evidence_refs
excluded_evidence_refs
confidence
error_bucket
nonclaims
```

Numeric residual:

```text
residual = observed_value - forecast_value
absolute_residual = abs(observed_value - forecast_value)
relative_residual = absolute_residual / accepted_denominator
```

R3 must define denominator rules and must not silently use zero or missing denominator.

Categorical residual:

```text
same category -> accurate
neighboring category -> minor_error or material_error depending on declared order
opposite/extreme category -> severe_error
unknown / missing -> not_calculable
category_distance
```

Category order:

```text
dry_candidate < normal_candidate < wet_candidate
cold_candidate < normal_candidate < hot_candidate
insufficient < partial < sufficient
```

Categorical distance is a calibration aid, not an agronomic action.

Residual calculation must not produce recommendation, action, dispatch, AO-ACT task, ROI, Field Memory write, model auto-update, priority, severity for operations, or prescription.

Forecast error severity is not agronomic severity and does not create action priority.

## Error Bucket

Error bucket values:

```text
not_calculable
accurate
minor_error
material_error
severe_error
missing_verification_evidence
invalid_forecast
invalid_post_event_evidence
```

Definitions:

```text
accurate: forecast and verification evidence match within accepted tolerance
minor_error: difference exists but below material threshold
material_error: difference affects forecast reliability review
severe_error: forecast materially wrong under declared residual method
missing_verification_evidence: forecast cannot be verified
not_calculable: data type or evidence quality prevents residual calculation
invalid_forecast: forecast object invalid
invalid_post_event_evidence: verification evidence invalid
```

Error bucket does not trigger action.

## Calibration Review Packet

A calibration review packet allows a human or later gated system to inspect why a forecast was accurate or wrong, without automatically changing model parameters.

Packet fields:

```text
calibration_review_packet_id
forecast_id
residual_id
subject_ref
base_state_estimate_ref
forecast_summary
verification_summary
residual_summary
error_bucket
confidence
uncertainty_drivers
evidence_refs
excluded_evidence_refs
review_status
review_recommendation
model_update
allowed: false
applied: false
nonclaims
```

Review status values:

```text
pending_review
reviewed
not_reviewable
```

`review_recommendation` must be null or absent. `review_recommendation` is not an agronomic recommendation. R3 does not generate action recommendations.

## Forecast Replay

Forecast replay inputs:

```text
forecast_engine_id
forecast_engine_version
forecast_contract_version
base_state_estimate_ref
state_replay_equivalence_hash
forecast_kind
subject_ref
issued_at
horizon
forecast_inputs
assumptions
post_event_evidence_window
residual_method
residual_method_version
error_bucket_policy
error_bucket_policy_version
calibration_review_contract_version
input_state_contract_version
```

Forecast replay outputs under fixed inputs:

```text
same forecast summary
same verification relation
same included/excluded post-event evidence
same residual calculation
same error bucket
same calibration review packet summary
same forecast_replay_equivalence_hash
```

Replay hash field:

```text
forecast_replay_equivalence_hash
```

Forecast replay hash inputs include forecast_engine_version, forecast_id or canonical forecast content, base_state_estimate_ref, horizon, forecast_vector, verification_window, post_event_evidence_refs, excluded_post_event_evidence_refs, residual_object, error_bucket, and calibration_review_packet summary.

Replay hash excludes wall-clock now, local machine path, render timestamp, random IDs, and transient process ID.

Forecast replay equivalence does not prove live forecast service is active.

## Forecast Freshness

Forecast freshness fields:

```text
forecast_freshness.status
issued_at
horizon.end
verification_window.end
verification_status
residual_status
calibration_review_status
```

Forecast freshness status values:

```text
pending_verification
ready_for_verification
verified
expired_unverified
not_verifiable
replay_only
unknown
```

Forecast freshness does not imply live runtime active, production service healthy, recommendation ready, or dispatch ready.

## Forecast / Residual Read Model

Read model fields:

```text
forecast_id
subject_ref
forecast_kind
forecast_mode
issued_at
base_state_estimate_ref
horizon
forecast_vector
confidence
uncertainty
verification_status
verification_window
post_event_evidence_refs
residual_ref
residual_summary
error_bucket
calibration_review_packet_ref
forecast_replay_equivalence_hash
nonclaims
```

Read model must not expose recommendation, action, dispatch command, AO-ACT task, ROI impact, Field Memory write, model update applied, prescription, priority, or next action.

## Versioning

Versioning fields:

```text
forecast_engine_id
forecast_engine_version
forecast_contract_version
residual_method_version
error_bucket_policy_version
calibration_review_contract_version
input_state_contract_version
```

Residual and replay equivalence are meaningless unless forecast and residual method versions are fixed.

## R3 Nonclaims

Forecast is not a recommendation. Forecast is not a prescription. Residual is not agronomic severity. Error bucket does not create action priority. Calibration review packet does not update model parameters. R3 does not dispatch. R3 does not create AO-ACT task. R3 does not compute ROI. R3 does not write Field Memory. R3 does not start field pilot. R3 does not prove live production runtime.

## Acceptance

```powershell
node scripts/runtime_acceptance/ACCEPTANCE_R3_FORECAST_CALIBRATION_RESIDUAL_LOOP_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

R3 acceptance is static repo read-only unless R3 implementation PR is separately scoped. It does not require frontend startup, backend startup, DB write, facts write, AO-ACT write, ROI write, Field Memory write, model update, Docker, server startup, web startup, or backend API.

## R4 Handoff

R4 Runtime Health Service Gate follows R3.

R3 provides forecast/residual/calibration review readiness for R4.

R4 is responsible for review health, service health, live monitoring distinction, production gateway distinction, device evidence package, runtime freshness, and health service readiness.

R3 only proves the forecast / residual / calibration review loop contract. R3 does not prove runtime service healthy.
