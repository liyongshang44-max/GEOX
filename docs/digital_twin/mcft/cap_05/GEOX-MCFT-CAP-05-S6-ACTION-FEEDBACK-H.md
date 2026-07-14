<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md -->
# MCFT-CAP-05 S6 — Action Feedback H Commit and Executed-Irrigation Adapter V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1
baseline merged main: 99221bb464818f8686718fd25df123e1096b2281
S5 remediation merged-main Gate: 29317273201 SUCCESS
runtime mode: REPLAY
canonical object type: twin_action_feedback_v1
transaction family: H_ACTION_FEEDBACK_COMMIT
migration delta: 0
global SSOT activation: deferred until S6 merged-main effectiveness
```

S6 converts one exact `irrigation_execution_receipt_evidence_v1` Replay Evidence record into one canonical `twin_action_feedback_v1`, persists it through the existing H transaction, and adapts eligible feedback into the existing `ExecutedIrrigationCandidateV1` contract.

This Runtime slice is deliberately separated from the later global Matrix/Authorization/Delivery/Task activation. The seven-file Runtime candidate must become merged-main effective first; the global SSOT settlement must not overwrite the already-effective S5 remediation record.

## Caller boundary

The internal service accepts only:

```text
exact Reality scope
receipt_evidence_ref
receipt_evidence_hash
```

The caller cannot inject Decision, Approved Plan, Dispatch disposition, executed amount, coverage, eligibility, Runtime Config, lineage or revision authority. Those values are resolved from immutable Evidence, the active Approved Plan projection and canonical G Decision readback.

## Receipt Evidence integrity and eligibility

The record must satisfy:

```text
record_type = irrigation_execution_receipt_evidence_v1
action_lifecycle_class = EXECUTION_RECEIPT
origin_source_kind = CONTROLLED_REPLAY_DATASET
epistemic_class = OBSERVED
quality.status = PASS
ingress_adapter_id = canonical_replay_evidence_ingress_v1
ingress_adapter_version = 1
unit = mm
```

Receipt integrity uses the effective S1 policy:

```text
S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1
```

`source_record_hash` is recomputed from the entire Receipt record, excluding only `source_record_hash` and `materialized_file_location`. Equality between a caller-supplied hash and a stored hash is not sufficient integrity proof.

`source_payload` and `canonical_payload` must have equal semantic hashes. Reality scope and `target_scope` must exactly match. S6 performs no volume-to-depth conversion.

## Status mapping

```text
FULL                 -> EXECUTED
PARTIAL              -> PARTIALLY_EXECUTED
UNKNOWN              -> EXECUTION_UNCERTAIN
NONE                 -> NOT_EXECUTED
PASSED               -> VALIDATED
PASSED_WITH_LIMITATIONS -> VALIDATED_WITH_LIMITATIONS
FAILED               -> REJECTED
PENDING              -> NOT_YET_VALIDATED
PASS quality         -> USABLE
LIMITED quality      -> USABLE
FAIL quality         -> UNUSABLE
```

Execution, validation and source quality remain independent axes. Canonical history may record an execution while validation is pending, but such feedback is not eligible for State input.

Final State-input eligibility is true only when:

```text
source claims eligible_for_state_input = true
execution_status in {EXECUTED, PARTIALLY_EXECUTED}
validation_status in {VALIDATED, VALIDATED_WITH_LIMITATIONS}
source_quality in {PASS, LIMITED}
```

## Time semantics

```text
execution_start <= execution_end <= ingested_at <= available_to_runtime_at
execution_start and execution_end are in the same UTC hour
Action Feedback logical_time = execution_end
Action Feedback as_of = available_to_runtime_at
ExecutedIrrigationCandidate.executed_at = execution_end
```

A late Receipt does not shift execution logical time into its availability hour and does not rewrite historical State automatically.

## Decision, Plan and Dispatch binding

The Receipt identifies one Approved Plan Evidence ref/hash. S6 requires the exact active row in `twin_approved_plan_binding_projection_v1`, whose reconstruction is protected by the effective S5 remediation. It then resolves the unique canonical G Decision through the Decision projection and canonical fact readback.

Execution must fall within the Plan effective interval.

Optional external Dispatch Evidence must be `PASS`, must bind to the same Plan, must state `EXTERNALLY_RECORDED`, and must state `geox_dispatch_created = false`. Without eligible Dispatch Evidence the disposition is `NOT_OBSERVED`. GEOX creates no dispatch.

## Amount and coverage semantics

The canonical H object preserves:

```text
actual_amount_mm
spatial_coverage_fraction
target_scope_equivalent_irrigation_mm
```

Frozen equation and standard Replay values:

```text
target_scope_equivalent_irrigation_mm = actual_amount_mm * spatial_coverage_fraction
13.600000 * 0.910000 = 12.376000
```

All arithmetic uses the existing scale-6 fixed-point water authority. The adapter passes raw amount and raw coverage; it does not multiply coverage. `aggregateExecutedIrrigationV1` remains the single authority that applies coverage exactly once. Approved amount is not execution authority.

## H persistence and idempotency

The existing `PostgresFeedbackPersistenceRepositoryV1` and `H_ACTION_FEEDBACK_COMMIT` transaction atomically maintain:

```text
public.facts canonical Action Feedback
H idempotency guard
Action Feedback projection
Decision / Approved Plan / Receipt evidence index
```

The same idempotency key and determinism hash returns `EXISTING_IDEMPOTENT_SUCCESS`; conflicting semantics fail closed.

## Adapter and event guard

Eligible H feedback maps to one `ExecutedIrrigationCandidateV1` with exact binding, source, scope, event, time, amount, coverage, eligibility and quality fields. `PARTIALLY_EXECUTED` is normalized to the candidate contract's `EXECUTED` marker while the source status remains in trace.

`requireSingleEligibleCap05ExecutionEventV1` rejects zero or more than one eligible event for a tick. S6 establishes no spatial-overlap inference.

## Runtime acceptance obligations

The S6 database acceptance must prove:

```text
S4 canonical Decision predecessor
S5 remediated active Approved Plan predecessor
standard Receipt -> canonical H
fixed-point amount and one-time coverage
response-loss idempotency
independent status mappings
forged full-record Receipt hash rejection
pending validation ineligibility
late no-shift
single-event guard
cross-hour rejection
volume rejection
forged covered-footprint rejection
projection and exact evidence index
no State, Forecast or Residual creation
```

## Preserved nonclaims

```text
NO_PUBLIC_ROUTE
NO_GEOX_APPROVAL_AUTHORITY
NO_GEOX_DISPATCH_CREATION
NO_RECEIPT_CONSUMING_STATE_TICK
NO_STATE_OR_CHECKPOINT_MUTATION
NO_FORECAST_EXECUTION
NO_FORECAST_RESIDUAL_COMMIT
NO_RECOMMENDATION
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_MIGRATION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_CAP_06_AUTHORIZATION
NO_GLOBAL_SSOT_ACTIVATION_IN_RUNTIME_PR
```
