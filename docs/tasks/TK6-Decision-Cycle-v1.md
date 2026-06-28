# docs/tasks/TK6-Decision-Cycle-v1.md

# TK6 — Decision Cycle v1

TK6 introduces the final formal Twin Kernel object in the original task line:

- `decision_cycle_v1`

This task creates a human-in-the-loop cycle record that links the formal Twin Kernel objects from TK1 through TK5 with external operational references. It does not create recommendations, approvals, operation plans, AO-ACT tasks, `/api/v1/actions/*` tasks, receipts, acceptance records, ROI records, Field Memory records, or model updates.

## Position in the original Twin Kernel line

Original task line:

```text
TK0 → TK1 → TK2 → TK3 → TK4 → TK5 → TK6
```

Current position:

```text
TK0 ✅ Twin Kernel Preflight
TK1 ✅ field_state_snapshot_v1
TK2 ✅ forecast_run_v1
TK3 ✅ scenario_set_v1
TK4 ✅ calibration_replay_v1 + forecast_error_v1
TK5 ✅ field_learning_candidate_v1 → formal Field Memory gate
TK6 ⬅️ decision_cycle_v1 / human-in-the-loop loop
```

## Input boundary

TK6 may read formal Twin Kernel objects:

- `field_state_snapshot_v1`
- `forecast_run_v1`
- `scenario_set_v1`
- `calibration_replay_v1`
- `forecast_error_v1`
- `field_learning_candidate_v1`

TK6 may also accept external reference IDs in the request payload, including:

- `recommendation_id`
- `approval_id`
- `operation_plan_id`
- `act_task_id`
- `receipt_id`
- `as_executed_id`
- `acceptance_id`
- `post_irrigation_verification_id`
- `roi_entry_id`
- `field_memory_id`

These are pointer references only. TK6 must not create or mutate those downstream objects.

## Output object

`decision_cycle_v1` is a cycle/bus record, not an executor.

Minimum fields:

- `decision_cycle_id`
- `snapshot_id`
- `forecast_run_id`
- `scenario_set_id`
- `calibration_replay_id`
- `forecast_error_id`
- `field_learning_candidate_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `cycle_status`
- `current_stage`
- `external_refs_json`
- `state_machine_json`
- `human_gate_json`
- `boundary_flags_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## State machine

The first version records the following human-in-the-loop stages:

```text
OBSERVED
STATE_ESTIMATED
FORECASTED
SCENARIO_COMPARED
RECOMMENDATION_CANDIDATE_CREATED
APPROVAL_REQUIRED
APPROVED
TASK_CREATED
DISPATCHED
RECEIPT_RECEIVED
ACCEPTED
ROI_FORMALIZED
MEMORY_CANDIDATE_CREATED
FORMAL_MEMORY_WRITTEN
CALIBRATED
```

A stage may be incomplete. TK6 records this condition; it does not fill in missing downstream objects.

## Hard boundaries

TK6 must not:

- create recommendations
- create approvals
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create dispatch records
- create receipts
- create acceptance records
- create ROI records
- create Field Memory records
- update model parameters
- mutate TK1–TK5 records
- allow forecast/scenario/recommendation to auto-jump into task creation

## Human gate rule

Any task reference without an approval reference is treated as a boundary violation in the cycle record.

TK6 must preserve:

```text
forecast_to_task_autojump_allowed = false
scenario_to_task_autojump_allowed = false
recommendation_to_task_autojump_allowed = false
human_approval_required_before_task = true
automatic_task_created = false
```

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK6_DECISION_CYCLE_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK6_DECISION_CYCLE_V1_ACCEPTANCE
decision_cycle_v1_present = true
no_forbidden_writes = true
no_prior_object_mutations = true
human_gate_preserved = true
original_task_line_complete = true
```

## Done

TK6 is done when the repository has a schema migration, deterministic builder, registered routes, and acceptance proving that `decision_cycle_v1` exists as a human-in-the-loop cycle record without creating or mutating any downstream operational, ROI, Field Memory, or model-update object.
