<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S7-RECEIPT-CONSUMING-TICK.md -->
# MCFT-CAP-05 S7 — Receipt-consuming A1 State Tick V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1
baseline merged main: 210622dbbfb96e6999568630e5095f7c6097d8c7
S6 Runtime status: MERGED_EFFECTIVE
S6 validation-orthogonality remediation PR: 2465
S6 validation-orthogonality remediation merge: 210622dbbfb96e6999568630e5095f7c6097d8c7
S6 SSOT activation PR: 2463
S7 authorization status: AUTHORIZED_NOT_STARTED at baseline
runtime mode: REPLAY
State transaction family: A_STATE_TICK_COMMIT
Forecast/Scenario path: existing CAP-04 A1 + B
migration delta: 0
global SSOT settlement: deferred until S7 merged-main effectiveness
```

S7 executes exactly one explicit hourly tick. It does not introduce another State, Forecast or Scenario implementation. It selects canonical `twin_action_feedback_v1`, adapts the selected H object into the existing `ExecutedIrrigationCandidateV1` semantics, and delegates the full tick to the unchanged CAP-04 A1 successful orchestration:

```text
Evidence Window
→ Dynamics
→ observation selection
→ Assimilation
→ posterior State
→ 72-hour Forecast
→ A1 eight-member commit
→ three-option Scenario Set
→ B commit
→ T+1 handoff
```

## Canonical H selection

The selector operates on canonical H objects under exact Reality scope and one explicit hourly target time.

```text
window = (T-1h, T]
evidence_cutoff_time = T
Action Feedback logical_time = execution_end
Action Feedback as_of = available_to_runtime_at
```

Execution status, validation status, source quality and canonical eligibility remain independent axes. Under the remediation-effective contract, eligible feedback must satisfy:

```text
execution_status in {EXECUTED, PARTIALLY_EXECUTED}
validation_status in {NOT_YET_VALIDATED, VALIDATED, VALIDATED_WITH_LIMITATIONS}
source_quality in {PASS, LIMITED}
eligible_for_state_input = true
```

`NOT_YET_VALIDATED` may remain eligible when execution Evidence is trustworthy. `REJECTED`, `EXECUTION_UNCERTAIN`, `NOT_EXECUTED`, `FAIL` quality or canonical ineligibility remains fail-closed.

Future, late, outside-window, wrong-scope and ineligible feedback remains canonical but is not consumed. Late feedback is not shifted to the availability hour and does not trigger automatic historical rewrite.

## Duplicate and multiple-event policy

Semantic execution identity is:

```text
binding_id
+ origin_source_id
+ exact Reality scope
+ event_id
+ execution_end
```

For one semantic identity:

```text
same payload → deterministic duplicate collapse
different payload → fail closed
```

After duplicate collapse, more than one distinct eligible event in the same scope-hour fails closed. S7 does not infer spatial overlap and does not sum multiple distinct execution events.

## Runtime Config authority

The tick request must pin one immutable Runtime Config ref/hash. In addition to the existing CAP-04 Forecast/Scenario fields, the payload must explicitly pin:

```text
action_feedback_state_input_policy_id
action_feedback_quality_mapping_policy_id
evidence_cutoff_policy_id
late_receipt_policy_id
execution_interval_policy_id
multiple_execution_event_policy_id
spatial_overlap_policy_id
actual_amount_semantics_policy_id
effective_irrigation_policy_id
volume_to_depth_policy_id
action_feedback_adapter_policy_id
```

Missing or mismatched policy fields fail closed. S7 does not modify active model parameters.

## Adapter boundary

Canonical H is represented inside the existing immutable Evidence Window through a deterministic Runtime adapter record:

```text
source_record_id = Action Feedback object_id
source_record_hash = Action Feedback determinism_hash
record_type = irrigation_execution_evidence_v1
source_object_type = twin_action_feedback_v1
adapter_id = CANONICAL_H_TO_DYNAMICS_EXECUTION_RECORD_V1
```

The adapter record is not a new canonical object and is not appended to `public.facts`. It exists only inside the frozen tick Evidence Window so the existing Dynamics path can consume H without reinterpreting historical CAP-02/CAP-04 Evidence contracts.

The adapter preserves:

```text
actual_amount_mm
spatial_coverage_fraction
target_scope_equivalent_irrigation_mm
execution_status
validation_status
source_quality
eligible_for_state_input
execution_start
execution_end
ingested_at
available_to_runtime_at
source Action Feedback ref/hash
selection disposition and reason
```

Validation status is retained without being converted into source quality or canonical eligibility. The adapter performs no coverage multiplication and no volume-to-depth conversion.

## Dynamics and one-time coverage

Standard controlled Replay values:

```text
actual covered-footprint depth = 13.600000 mm
spatial coverage = 0.910000
target-scope-equivalent irrigation = 12.376000 mm
```

The existing `aggregateExecutedIrrigationV1` remains the single authority that applies coverage exactly once. Approved Plan amount is not execution authority.

## Evidence Window trace

The frozen Evidence Window must preserve:

```text
evidence_cutoff_time
selected Action Feedback ref/hash
excluded Action Feedback refs and reasons
deduplicated Action Feedback refs
adapter ID
raw amount and coverage
validation_status
eligible_for_state_input
```

The canonical `twin_evidence_window_v1` consumes the selected H object ID as an Evidence ref. The State Transition and posterior State retain the normal CAP-04 chain.

## A1 and B reuse

S7 reuses `Cap04ForecastScenarioSingleTickServiceV1` without modifying its source. The receipt-consuming composition supplies an augmented Replay Evidence source and a policy-validating Runtime Config repository.

Successful standard tick requirements:

```text
A1 member count = 8
Forecast status = COMPLETED
Forecast points = 72
Scenario option count = 3
points per Scenario trajectory = 72
checkpoint sequence increments by 1
T+1 handoff references exact posterior/checkpoint/Forecast
```

Both `VALIDATED` and trustworthy `NOT_YET_VALIDATED` acceptance paths must prove the same normal A1, Forecast and Scenario cardinalities. Completed replay returns the same A1/B hashes before Replay Evidence, Action Feedback, Config, lease or canonical write work.

## PostgreSQL read path

`PostgresActionFeedbackTickSourceV1` reads through:

```text
twin_action_feedback_projection_v1.source_fact_id
→ public.facts.record_json.payload
→ validateCap05ActionFeedbackV1
```

Projection fields and canonical H envelope identity/hash/scope/time must match exactly. The source is read-only and creates no fact or projection mutation.

The PostgreSQL acceptance must prove canonical readback of trustworthy `NOT_YET_VALIDATED`, positive selector consumption when it is the exact candidate, fail-closed behavior for multiple eligible events, late exclusion, zero read-path writes and exact Reality scope.

## Standard timeline

```text
01:30–01:50 execution
01:55 Action Feedback available
02:00 evidence cutoff
02:00 normal A1 State Tick consumes H
02:00 posterior State committed
02:00 new 72-hour Forecast committed
02:00 new three-option Scenario Set committed
03:00 T+1 handoff
```

## Preserved nonclaims

```text
NO_NEW_CANONICAL_TWIN_OBJECT_TYPE
NO_NEW_TRANSACTION_FAMILY
NO_MIGRATION
NO_PUBLIC_ROUTE
NO_WEB
NO_RANGE_LOOP
NO_RESTART_OR_BACKFILL_MODE
NO_SCHEDULER
NO_AUTOMATIC_LATE_HISTORY_REWRITE
NO_SPATIAL_OVERLAP_INFERENCE
NO_VOLUME_TO_DEPTH_CONVERSION
NO_RECOMMENDATION
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_FORECAST_RESIDUAL_COMMIT
NO_OUTCOME_TRACE_CLOSURE
NO_CAP_06_AUTHORIZATION
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
NO_GLOBAL_SSOT_SETTLEMENT_IN_RUNTIME_PR
```
