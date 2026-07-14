<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-EVIDENCE.md -->
# MCFT-CAP-05 S5 — Approval Assertion and Approved Plan Evidence Binding V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1
baseline merged main: 7f2f2bec144cee4d90608c3a25c3dc7cac9f9189
runtime mode: REPLAY
target: Level A — Deterministic Replay Twin
canonical Twin object delta: 0
transaction family delta: 0
migration delta: 0
```

This slice binds two externally originated Replay Evidence records to the unique canonical G Decision established by S4:

```text
approval_assertion_evidence_v1
approved_irrigation_plan_snapshot_v1
```

Neither record is a canonical Twin object. GEOX does not create an approval request, exercise approval authority, or create dispatch.

## Approval Assertion boundary

An eligible Approval Assertion must satisfy:

```text
record_type = approval_assertion_evidence_v1
action_lifecycle_class = APPROVAL_ASSERTION
origin_source_kind = CONTROLLED_REPLAY_DATASET
quality.status = PASS
epistemic_class = ASSERTED
approval_semantics = EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION
approval_status = APPROVED
approver_class = HUMAN
geox_approval_request_created = false
geox_approval_authority_exercised = false
```

The Assertion carries exact Decision-request Evidence ref/hash and selected Scenario option ref/hash. The service resolves exactly one `twin_decision_record_v1` through the S4 Decision projection and canonical `public.facts` readback. Missing or ambiguous Decision binding fails closed.

## Approved Plan boundary

An eligible Approved Plan must satisfy:

```text
record_type = approved_irrigation_plan_snapshot_v1
action_lifecycle_class = APPROVED_PLAN
origin_source_kind = CONTROLLED_REPLAY_DATASET
quality.status = PASS
epistemic_class = ASSERTED
plan_status = APPROVED
active_for_decision = true
```

The Plan must bind exactly to:

```text
approval_assertion_ref/hash
decision_request_ref/hash
selected_option_ref/hash
target Reality scope
```

`approval_assertion_ref/hash` must identify the exact Assertion supplied in the same atomic binding operation.

## Amount separation

The selected canonical Scenario option is the sole authority for:

```text
scenario_amount_mm
```

The externally approved Plan is the sole authority for:

```text
approved_amount_mm
```

The frozen relationship is:

```text
amount_difference_mm = approved_amount_mm - scenario_amount_mm
```

A non-zero difference requires at least one explicit `amount_difference_reason_code`. The standard controlled Replay case is:

```text
scenario_amount_mm = 15.000000
approved_amount_mm = 14.000000
amount_difference_mm = -1.000000
reason = WATER_AVAILABILITY_LIMIT
```

Approved amount is not executed amount and is not consumed by State Dynamics in S5.

## Dispatch disposition

The S5 binding records one explicit disposition:

```text
NOT_OBSERVED
NOT_APPLICABLE
EXTERNALLY_RECORDED
```

For `NOT_OBSERVED` and `NOT_APPLICABLE`, dispatch Evidence ref/hash must be absent.

For `EXTERNALLY_RECORDED`, the service must read one eligible `external_dispatch_evidence_v1` from `public.facts`, verify exact ref/hash, Reality scope and Approved Plan ref/hash, and verify:

```text
dispatch_disposition = EXTERNALLY_RECORDED
geox_dispatch_created = false
```

The Dispatch Evidence is validated but is not created or rewritten by S5.

## Append-only Evidence and idempotency

Assertion and Plan are appended to `public.facts` under deterministic Evidence fact identity derived from `evidence_identity_key`.

The same Evidence identity and semantic hash returns:

```text
EXISTING_IDEMPOTENT_SUCCESS
```

The same identity with a different source hash fails closed and appends nothing.

Assertion fact, Plan fact and active-Plan projection mutation execute in one PostgreSQL transaction. Failure before projection commit rolls back both Evidence facts.

## Active Plan and supersession

For one exact Decision binding, at most one Plan projection may be active.

A second Plan must identify the current active Plan through:

```text
supersedes_plan_evidence_ref
supersedes_plan_evidence_hash
```

A valid supersession:

1. preserves the old Plan Evidence fact unchanged;
2. marks only the old projection row inactive;
3. inserts the new Plan Evidence fact;
4. inserts the new active projection row;
5. remains idempotent when either the old or new historical Plan is replayed.

A parallel active Plan without explicit supersession is rejected atomically.

## Recovery

`twin_approved_plan_binding_projection_v1` remains mutable and rebuildable. Recovery scans immutable Plan Evidence facts, inserts their projection rows, reapplies every supersession ref/hash, and verifies that no Decision binding has more than one active Plan.

Missing superseded Evidence, self-supersession, incomplete supersession identity or multiple final active Plans fails closed.

## PostgreSQL acceptance

Workflow `29312412661` proved:

```text
S4 canonical Human Decision predecessor replay: PASS
Assertion and Plan exact G Decision binding: PASS
scenario amount / approved amount separation: PASS
first Evidence writes: PASS
idempotent Evidence replay: PASS
forged Assertion identity rejection: PASS
wrong canonical Scenario amount rejection: PASS
missing amount-difference reason rejection: PASS
wrong external Dispatch Plan binding rejection: PASS
parallel Plan without supersession rejection: PASS
explicit Plan supersession: PASS
historical superseded Plan replay: PASS
facts-based supersession rebuild: PASS
canonical Twin object delta after S4: 0
Action Feedback delta: 0
repository typecheck: PASS
```

## Preserved nonclaims

```text
NO_GEOX_APPROVAL_REQUEST
NO_GEOX_APPROVAL_AUTHORITY
NO_GEOX_DISPATCH_CREATION
NO_NEW_CANONICAL_TWIN_OBJECT
NO_NEW_TRANSACTION_FAMILY
NO_MIGRATION
NO_PUBLIC_ROUTE
NO_RECOMMENDATION
NO_TASK_WRITE
NO_ACTION_FEEDBACK_WRITE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_FORECAST_EXECUTION
NO_RESIDUAL_MATCHING
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CAP_06_AUTHORIZATION
```
