<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-HUMAN-DECISION-G.md -->
# MCFT-CAP-05 S4 — Human Decision through G Transaction V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1
baseline merged main: 7e2de9c00a4ecc305c27b6572a63914f38157dbd
runtime mode: REPLAY
target: Level A — Deterministic Replay Twin
transaction family: G_HUMAN_DECISION_LINK_COMMIT
canonical object: twin_decision_record_v1
```

This slice establishes one internal Human Decision service. It does not expose a public route and does not create Approval, Plan, Task, Dispatch, Action Feedback, State, checkpoint, Recommendation, AO-ACT, calibration or model-activation authority.

## Caller-controlled input boundary

The service accepts only:

```text
exact Reality scope
decision_request_evidence_ref
decision_request_evidence_hash
decided_at
```

The caller cannot supply:

```text
actor identity
Scenario Set payload or hash
selected option ref or hash
active lineage or revision
Runtime Config
canonical object_id
canonical determinism_hash
```

Those values are derived from persisted Replay Evidence and PostgreSQL canonical/latest readback.

## Decision request Evidence

The source record must be exactly:

```text
record_type = controlled_human_decision_request_v1
origin_source_kind = CONTROLLED_REPLAY_DATASET
quality.status = PASS
actor_class = HUMAN
requested_disposition = SELECT_OPTION
```

Evidence identity is the exact `source_record_id` plus `source_record_hash`. Scope must match the requested Reality scope. `available_to_runtime_at` must be less than or equal to `decided_at`.

## Current Scenario authority

Before building a Decision, the service resolves:

```text
active lineage from twin_active_lineage_index_v1
current lineage/revision from twin_state_latest_index_v1
current Scenario from twin_scenario_latest_index_v1
latest successful Forecast from twin_forecast_success_latest_index_v1
canonical Scenario envelope from public.facts
```

The current Scenario must be sourced from the latest successful Forecast with exact ref/hash equality and must share the current lineage/revision context.

## Scenario option member identity

The semantic member ref is:

```text
geox-semantic-member://twin_scenario_set_v1/<scenario-set-id>/options/by-option-id/<option-id>
```

The semantic member hash is frozen to the S1 Replay Evidence identity basis:

```text
scenario_set_ref
scenario_set_hash
option_id
assumed_irrigation_mm
```

The fixed v1 amounts are:

```text
NO_ACTION = 0.000000 mm
IRRIGATE_NOW_15MM = 15.000000 mm
IRRIGATE_NOW_25MM = 25.000000 mm
```

The resolver additionally verifies that the canonical Scenario option carries the corresponding exact `requested_irrigation_mm`. Hashing the entire mutable option representation is not the v1 member-identity authority.

## G commit

After all readback checks pass, the service:

1. builds `twin_decision_record_v1` with the existing S2 contract;
2. applies the immutable second-write policy;
3. delegates persistence to `PostgresFeedbackPersistenceRepositoryV1`;
4. commits through the existing `G_HUMAN_DECISION_LINK_COMMIT` identity kind;
5. returns either `INSERTED` or `EXISTING_IDEMPOTENT_SUCCESS`.

A different Decision for the same Scenario is rejected as `CAP05_DECISION_IMMUTABLE_CONFLICT`. It does not create a second canonical Decision.

## PostgreSQL acceptance

Workflow `29310564723` proved:

```text
complete CAP-04 predecessor replay: PASS
current Scenario canonical readback: PASS
Human actor authority from Evidence: PASS
G first write: PASS
response-loss retry: PASS
forged Evidence hash rejection: PASS
forged option hash rejection: PASS
stale Scenario rejection: PASS
late Evidence rejection: PASS
non-Human actor rejection: PASS
second different Decision conflict: PASS
wrong Reality scope rejection: PASS
Approval/Plan/Task/Action Feedback/State/checkpoint inferred writes: 0
```

## Preserved nonclaims

```text
NO_PUBLIC_ROUTE
NO_RECOMMENDATION
NO_APPROVAL_AUTHORITY
NO_APPROVED_PLAN_WRITE
NO_TASK_OR_DISPATCH
NO_ACTION_FEEDBACK_WRITE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_FORECAST_EXECUTION
NO_RESIDUAL_MATCHING
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CAP_06_AUTHORIZATION
```
