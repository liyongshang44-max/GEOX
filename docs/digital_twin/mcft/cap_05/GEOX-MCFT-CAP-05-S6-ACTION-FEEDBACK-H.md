<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md -->
# MCFT-CAP-05 S6 — Action Feedback H Commit and Executed-Irrigation Adapter V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1
baseline merged main: ef1c789b15a3e73f93c7e63907519faecb027563
runtime mode: REPLAY
target: Level A — Deterministic Replay Twin
canonical object type: twin_action_feedback_v1
transaction family: H_ACTION_FEEDBACK_COMMIT
migration delta: 0
```

S6 converts one exact `irrigation_execution_receipt_evidence_v1` Replay Evidence record into one canonical `twin_action_feedback_v1`, persists it through the existing H transaction, and adapts eligible feedback into the existing `ExecutedIrrigationCandidateV1` contract.

## Caller boundary

The internal service accepts only:

```text
exact Reality scope
receipt_evidence_ref
receipt_evidence_hash
```

The caller cannot supply Decision, Approved Plan, Dispatch disposition, executed amount, coverage, eligibility, Runtime Config, lineage or revision authority.

Those values are resolved from PostgreSQL canonical and Evidence readback.

## Receipt Evidence eligibility

The source record must satisfy:

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

`source_payload` and `canonical_payload` must have the same semantic hash. Reality scope and `target_scope` must exactly match the requested scope.

S6 performs no volume-to-depth conversion. Any unit other than `mm` fails closed.

## Status mapping

Execution status mapping is explicit:

```text
FULL                 -> EXECUTED
PARTIAL              -> PARTIALLY_EXECUTED
UNKNOWN              -> EXECUTION_UNCERTAIN
NONE                 -> NOT_EXECUTED
EXECUTED              -> EXECUTED
PARTIALLY_EXECUTED    -> PARTIALLY_EXECUTED
EXECUTION_UNCERTAIN   -> EXECUTION_UNCERTAIN
NOT_EXECUTED          -> NOT_EXECUTED
```

Validation status mapping is independent:

```text
PASSED                    -> VALIDATED
PASSED_WITH_LIMITATIONS   -> VALIDATED_WITH_LIMITATIONS
FAILED                    -> REJECTED
PENDING                   -> NOT_YET_VALIDATED
VALIDATED                 -> VALIDATED
VALIDATED_WITH_LIMITATIONS -> VALIDATED_WITH_LIMITATIONS
REJECTED                  -> REJECTED
NOT_YET_VALIDATED         -> NOT_YET_VALIDATED
```

Source-quality mapping for the existing adapter is:

```text
PASS     -> USABLE
LIMITED  -> USABLE
FAIL     -> UNUSABLE
```

Execution and validation remain orthogonal. An execution may be `EXECUTED` while validation is `NOT_YET_VALIDATED`; such a record is canonical history but is not eligible for State input.

## State-input eligibility

Final eligibility is true only when all conditions hold:

```text
source record claims eligible_for_state_input = true
execution_status in {EXECUTED, PARTIALLY_EXECUTED}
validation_status in {VALIDATED, VALIDATED_WITH_LIMITATIONS}
source_quality in {PASS, LIMITED}
```

`EXECUTION_UNCERTAIN`, `NOT_EXECUTED`, `REJECTED`, `NOT_YET_VALIDATED` or `FAIL` cannot enter State Dynamics.

## Time semantics

Frozen role-time order:

```text
execution_start <= execution_end <= ingested_at <= available_to_runtime_at
```

Execution start and end must be within the same UTC hour in S6.

Canonical time mapping:

```text
Action Feedback logical_time = execution_end
Action Feedback as_of = available_to_runtime_at
ExecutedIrrigationCandidate.executed_at = execution_end
ExecutedIrrigationCandidate.ingested_at = receipt ingested_at
```

A late Receipt does not shift logical execution time into the availability hour and does not rewrite historical State automatically.

## Decision, Plan and Dispatch binding

The Receipt identifies one Approved Plan Evidence ref/hash. S6 requires an active row in `twin_approved_plan_binding_projection_v1`, then resolves the unique canonical S4 G Decision through the Decision projection and canonical `public.facts` readback.

Execution must remain inside the Plan effective interval.

If the Receipt carries external Dispatch Evidence ref/hash, S6 verifies:

```text
record_type = external_dispatch_evidence_v1
origin_source_kind = CONTROLLED_REPLAY_DATASET
quality.status = PASS
dispatch_disposition = EXTERNALLY_RECORDED
approved_plan_ref/hash = exact active Plan
geox_dispatch_created = false
```

If no Dispatch Evidence identity is present, disposition is `NOT_OBSERVED`.

S6 does not create dispatch.

## Amount and coverage semantics

The canonical H object preserves:

```text
actual_amount_mm
spatial_coverage_fraction
target_scope_equivalent_irrigation_mm
```

Frozen equation:

```text
target_scope_equivalent_irrigation_mm
  = actual_amount_mm * spatial_coverage_fraction
```

Standard controlled Replay values:

```text
actual_amount_mm = 13.600000
spatial_coverage_fraction = 0.910000
target_scope_equivalent_irrigation_mm = 12.376000
```

The Action Feedback adapter passes the raw `actual_amount_mm` and `spatial_coverage_fraction` into `ExecutedIrrigationCandidateV1`. It does not replace the amount with `12.376000` and does not multiply coverage.

The existing `aggregateExecutedIrrigationV1` is the single authority that applies coverage exactly once and produces `12.376000` effective irrigation.

Approved amount is not copied into the execution candidate and is not execution authority.

## H persistence and idempotency

The canonical object is persisted through the existing `PostgresFeedbackPersistenceRepositoryV1` and transaction variant:

```text
H_ACTION_FEEDBACK_COMMIT
```

The transaction writes atomically:

```text
public.facts canonical Action Feedback
H idempotency guard
Action Feedback projection
Decision / Approved Plan / Receipt evidence index rows
```

The same idempotency key and determinism hash returns `EXISTING_IDEMPOTENT_SUCCESS`. Conflicting semantics fail closed.

## Adapter and event guard

An eligible canonical Action Feedback maps to one `ExecutedIrrigationCandidateV1` with:

```text
binding_id
origin_source_id
exact scope
event_id
source_record_id
executed_at
ingested_at
executed_amount_mm
coverage_fraction
eligible_for_state_input
source_quality = USABLE
execution_status = EXECUTED
```

The adapter normalizes `PARTIALLY_EXECUTED` into the candidate contract's `EXECUTED` marker while retaining the source status in adapter trace.

`requireSingleEligibleCap05ExecutionEventV1` rejects zero or more than one eligible event for a tick. S6 does not establish spatial-overlap inference.

## PostgreSQL acceptance

Workflow `29313657871` proved:

```text
S4 canonical Human Decision predecessor replay: PASS
S5 active Approved Plan predecessor: PASS
standard Receipt to canonical H Action Feedback: PASS
13.600000 x 0.910000 = 12.376000: PASS
coverage applied exactly once by existing aggregator: PASS
H response-loss retry: PASS
execution / validation / quality mappings: PASS
validation orthogonality: PASS
late no-shift: PASS
single-event guard: PASS
cross-hour rejection: PASS
no volume conversion: PASS
forged covered-footprint amount rejection: PASS
Action Feedback projection and evidence index: PASS
repository typecheck: PASS
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
```
