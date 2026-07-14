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

S7 selects canonical `twin_action_feedback_v1`, adapts the selected H object into the existing executed-irrigation contract, and delegates one explicit hourly tick to the unchanged CAP-04 A1 successful orchestration:

```text
canonical H
→ exact hourly selector and cutoff trace
→ immutable Evidence Window adapter record
→ existing Dynamics and Assimilation
→ posterior State
→ 72-hour Forecast
→ A1 eight-member commit
→ three-option Scenario Set and B commit
→ T+1 handoff
```

## Selection contract

```text
window = (T-1h, T]
evidence_cutoff_time = T
Action Feedback logical_time = execution_end
Action Feedback as_of = available_to_runtime_at
```

Execution status, validation status, source quality and canonical eligibility are independent axes. Eligible feedback must satisfy:

```text
execution_status in {EXECUTED, PARTIALLY_EXECUTED}
validation_status in {NOT_YET_VALIDATED, VALIDATED, VALIDATED_WITH_LIMITATIONS}
source_quality in {PASS, LIMITED}
eligible_for_state_input = true
```

`NOT_YET_VALIDATED` may remain eligible when execution Evidence is trustworthy. `REJECTED`, `EXECUTION_UNCERTAIN`, `NOT_EXECUTED`, `FAIL` quality or canonical ineligibility remains fail-closed.

Future, late, outside-window and wrong-scope feedback remains canonical but is excluded. Late feedback is never shifted into its availability hour and does not trigger automatic historical rewrite.

## Duplicate and multiple-event policy

Semantic identity is the exact combination of `binding_id`, `origin_source_id`, Reality scope, `event_id`, and `execution_end`. Identical duplicates collapse deterministically. Conflicting duplicates fail closed. More than one distinct eligible event in one scope-hour fails closed; S7 establishes no spatial-overlap inference and does not sum distinct events.

## Runtime Config authority

The immutable Runtime Config must pin:

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

Missing or mismatched fields fail closed.

## Evidence Window adapter

```text
source_record_id = Action Feedback object_id
source_record_hash = Action Feedback determinism_hash
record_type = irrigation_execution_evidence_v1
source_object_type = twin_action_feedback_v1
adapter_id = CANONICAL_H_TO_DYNAMICS_EXECUTION_RECORD_V1
```

The adapter record exists only inside the frozen tick Evidence Window. It is not a new canonical object and is not appended to `public.facts`. It preserves raw amount, coverage, execution status, validation status, source quality, canonical eligibility, exact times, source ref/hash, cutoff and selection trace. Validation status is not converted into quality or eligibility.

It applies neither coverage nor volume conversion. The existing aggregator remains the single authority for:

```text
13.600000 × 0.910000 = 12.376000 mm
```

Approved Plan amount is not execution authority.

## A1 and B reuse

S7 reuses `Cap04ForecastScenarioSingleTickServiceV1` without modifying its source. A successful tick must prove:

```text
A1 member count = 8
Forecast status = COMPLETED
Forecast points = 72
Scenario option count = 3
points per Scenario trajectory = 72
checkpoint sequence increments by 1
T+1 handoff references exact posterior/checkpoint/Forecast
```

Both `VALIDATED` and trustworthy `NOT_YET_VALIDATED` paths must produce the same normal A1, Forecast and Scenario cardinalities. Completed replay returns the same A1/B hashes without Evidence or H reselection.

## PostgreSQL source

`PostgresActionFeedbackTickSourceV1` reads projection pointers through canonical `public.facts`, validates the H envelope, and verifies exact projection identity, hash, scope and time. It is read-only.

The database acceptance proves canonical readback of trustworthy `NOT_YET_VALIDATED`, positive selection when it is the sole exact candidate, fail-closed behavior for multiple eligible events, late exclusion, zero writes, and exact Reality scope.

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
