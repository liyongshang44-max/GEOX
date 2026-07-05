# R2 Online State Estimation Loop

## Phase

R2 Online State Estimation Loop / R2 在线状态估计循环.

## Purpose

R2 defines the minimum contract and readiness gate for turning R1 state-eligible evidence into deterministic state estimates.

R2 answers what state object is estimated, which R1 evidence window is used, how often estimation runs, how missing or late evidence is handled, how confidence and uncertainty are represented, how replay equivalence is proven, and what read model exposes the estimate.

R2 is state estimation contract plus readiness acceptance. R2 is not forecast. R2 is not calibration. R2 is not recommendation. R2 is not dispatch. R2 is not ROI. R2 is not Field Memory.

## Preconditions

R1 Runtime Evidence Stream Readiness is complete.

R2 consumes only R1 state-eligible evidence. Evidence marked `state_eligible = false` must not enter the R2 estimate input set.

R2 follows R1 and precedes R3 Forecast Calibration & Residual Loop.

## Non-goals

R2 does not implement forecast simulation. R2 does not implement residual calibration. R2 does not implement recommendation. R2 does not implement dispatch. R2 does not implement AO-ACT. R2 does not implement ROI. R2 does not implement Field Memory. R2 does not implement model learning. R2 does not start field pilot execution. R2 does not claim autonomous operation.

R2 must not create recommendation facts, dispatch tasks, AO-ACT tasks, ROI ledger entries, Field Memory entries, model update records, or autonomous operation records.

## State Object Contract

R2 defines the state object contract required before forecasting.

The minimum state object contains:

```text
state_id
state_kind
tenant_id
project_id
field_id or group_id
state_window_start
state_window_end
as_of
estimate_generated_at
input_evidence_refs
input_evidence_window
estimate_values
confidence
uncertainty
coverage
freshness
quality_flags
state_status
state_ineligible_reasons
replay_ref
provenance_ref
determinism_hash
```

R2 does not require an immediate DB schema migration. R2 requires these semantics to be preserved before a runtime estimate can be considered readiness-gated.

## State Kinds

R2 registers these state kind categories:

```text
soil_moisture_state
soil_temperature_state
weather_context_state
field_observation_state
device_signal_state
evidence_health_state
```

A future state kind requires accepted R1 evidence kinds, state window semantics, confidence semantics, uncertainty semantics, missing behavior, replay equivalence, and acceptance update.

## Input Evidence Window

R2 estimates state from an explicit input evidence window.

The input window must define:

```text
window_start
window_end
as_of
lookback_ms
expected_interval_ms
min_coverage_ratio
max_allowed_gap_ms
allowed_lateness_ms
source_scope
subject_scope
required_evidence_kinds
```

Rules:

- Use only R1 state-eligible evidence.
- Preserve evidence references; do not inline or reshape raw evidence.
- Do not fabricate samples.
- Do not treat replay-only input as live runtime input.
- Do not silently mix subject scopes.
- Do not use evidence outside the declared window unless late-evidence policy explicitly allows it.

## Estimate Cadence

R2 defines estimate cadence separately from evidence cadence.

Minimum cadence fields:

```text
estimate_interval_ms
as_of_tick
window_alignment
max_compute_delay_ms
late_evidence_reestimate_policy
```

Supported cadence modes:

```text
manual_replay
scheduled_replay
runtime_candidate
runtime_verified
```

Only `runtime_verified` may support live state-estimation claims. `manual_replay`, `scheduled_replay`, and `runtime_candidate` must remain nonclaim-bound.

## Estimate Values

R2 estimate values must be typed and scoped.

Example shape:

```json
{
  "soil_moisture": {
    "value": null,
    "unit": "percent_vwc",
    "depth_cm": null,
    "method": "not_computed_in_R2_contract_only"
  },
  "soil_temperature": {
    "value": null,
    "unit": "celsius",
    "depth_cm": null,
    "method": "not_computed_in_R2_contract_only"
  }
}
```

R2 readiness documentation may define the shape without implementing a numerical estimator. A later implementation PR may compute values only after evidence input and acceptance are explicit.

## Confidence and Uncertainty

R2 must represent confidence and uncertainty separately.

Minimum fields:

```text
confidence_score
confidence_level
uncertainty_band
uncertainty_unit
uncertainty_reason
input_coverage_ratio
input_gap_ms
source_trust_level
method_confidence
```

Confidence is a summary of whether the estimate is usable. Uncertainty describes expected error or uncertainty range. High confidence must not hide high uncertainty. Low uncertainty must not imply source trust when evidence quality is weak.

Recommended confidence levels:

```text
high
medium
low
not_usable
unknown
```

## Coverage and Gaps

R2 coverage fields:

```text
points_expected
points_present
coverage_ratio
largest_gap_ms
required_kinds_present
missing_required_kinds
stale_sources
delayed_sources
duplicate_count
invalid_count
```

Coverage cannot be inflated by duplicate evidence. Missing required evidence must reduce eligibility or confidence. Stale evidence must be visible in freshness and quality flags.

## Missing Evidence Behavior

Missing evidence behavior:

```text
state_status = insufficient_evidence
state_eligible = false or confidence_level = not_usable
state_ineligible_reason includes missing evidence
no recommendation
no forecast handoff unless R3 explicitly accepts insufficient states
```

R2 must not fabricate samples, substitute simulated values without marking simulation, or convert missing evidence into confidence.

## Late Evidence Behavior

Late evidence behavior:

```text
preserve original occurred_at
record late ingestion or availability
mark late_evidence_present
apply late_evidence_reestimate_policy
never silently mutate prior estimate
```

R2 can define future re-estimation policy, but this R2 readiness gate does not require a re-estimation runtime.

## Duplicate Evidence Behavior

Duplicate evidence behavior:

```text
deduplicate for coverage
preserve duplicate audit count
never inflate coverage_ratio
record duplicate policy in quality_flags
```

## State Status

Recommended state status values:

```text
usable
usable_with_caution
insufficient_evidence
stale
invalid_input
replay_only
not_computed
unknown
```

`replay_only` means state is replay-backed and cannot support live runtime claims. `not_computed` means the contract is defined but runtime estimator is not implemented.

## Replay Equivalence

R2 replay equivalence requires:

```text
same R1 evidence input window
same as_of
same estimator version
same config version
same state output summary
same determinism_hash
same state_status
same confidence / uncertainty summary
```

Replay may differ in `replayed_at`, but it must preserve occurred_at, source identity, subject identity, estimate window, estimate output summary, and determinism hash.

## State Read Model

R2 state read model must expose:

```text
state_id
state_kind
subject_ref
window
as_of
estimate_generated_at
state_status
confidence
uncertainty
coverage
freshness
quality_flags
input_evidence_refs
provenance_ref
replay_ref
determinism_hash
```

The read model is read-only. It must not create facts, recommendations, dispatch tasks, ROI entries, Field Memory entries, or model updates.

## Freshness and Usability

R2 state freshness is derived from input evidence freshness and estimate generation time.

Minimum fields:

```text
state_freshness_status
last_input_evidence_at
last_input_ingested_at
estimate_generated_at
max_state_age_ms
input_freshness_status
usable_for_forecast
```

R2 can mark a state `usable_for_forecast = true` only when evidence eligibility, coverage, freshness, confidence, and uncertainty meet documented thresholds.

`usable_for_forecast` does not mean a forecast exists. R3 owns forecast and residual calibration.

## Readiness Summary

R2 readiness summary shape:

```json
{
  "ok": true,
  "runtime_readiness": "R2_ONLINE_STATE_ESTIMATION_LOOP",
  "state_loop": {
    "mode": "contract_only_or_replay_backed",
    "live_claim": false,
    "uses_r1_state_eligible_evidence": true,
    "state_object_contract": true,
    "estimate_cadence_defined": true,
    "confidence_uncertainty_defined": true,
    "missing_late_duplicate_behavior_defined": true,
    "replay_equivalence_defined": true,
    "read_model_defined": true,
    "usable_for_forecast": false
  },
  "nonclaims": {
    "forecast_generated": false,
    "recommendation_generated": false,
    "dispatch_enabled": false,
    "ao_act_enabled": false,
    "roi_computed": false,
    "field_memory_learning": false,
    "autonomous_operation": false
  }
}
```

## Acceptance

```powershell
node scripts/runtime_acceptance/ACCEPTANCE_R2_ONLINE_STATE_ESTIMATION_LOOP_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

R2 acceptance is static repo read-only for this PR. It does not require backend startup, frontend startup, DB write, facts write, estimator runtime, forecast runtime, recommendation writer, dispatch writer, AO-ACT writer, ROI writer, Field Memory writer, Docker, server startup, web startup, or backend API.

## Nonclaims

R2 has no forecast. R2 has no residual calibration. R2 has no recommendation. R2 has no dispatch. R2 has no AO-ACT. R2 has no ROI. R2 has no Field Memory. R2 has no model update. R2 has no field pilot execution. R2 has no autonomous operation.

R2 does not claim live state estimation is production-ready. R2 does not claim continuous runtime monitoring active. R2 does not claim field pilot started. R2 does not claim autonomous field operations.

## R3 Handoff

R3 Forecast Calibration & Residual Loop follows R2.

R2 does not forecast. R2 provides state object, state window, confidence, uncertainty, freshness, read model, and replay equivalence boundary for R3.

R3 is responsible for forecast generation, residual comparison, calibration review, forecast error tracking, and forecast usability.
