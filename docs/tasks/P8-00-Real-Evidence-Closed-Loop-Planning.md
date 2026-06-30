# docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md

## Purpose

P8-00 opens P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo.

P8 is not a continuation of fixture-only P7 runtime. P8 promotes the minimal Twin Kernel chain into a real-evidence-driven replay experiment that reads historical evidence, estimates state, predicts a held-out future window, reads later actual observations, computes error, reports calibration candidates, and renders a replay demo artifact.

P8 remains a read-only replay stage. It must not authorize, dispatch, execute, prescribe, learn, or mutate model or Field Memory state.

## Gate

```text
P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING
```

## Entry conditions

```text
previous_stage = P7 Twin Kernel Minimal Runtime
previous_completion_tag = p7_twin_kernel_minimal_runtime_completion
previous_completion_doc = docs/tasks/P7-07-Twin-Kernel-Completion-Review.md
p8_scope_explicitly_opened = true
```

## P8 stage definition

```text
stage_name = P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo
stage_goal = real-evidence-driven closed-loop replay experiment
stage_level_after_completion = L3.1 real-evidence closed-loop replay established
stage_is_not_l4 = true
completion_tag = p8_real_evidence_closed_loop_demo_completion
```

## Fixed replay scope

```text
problem = soil_moisture_state_estimation
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
closed_loop_replay_count = 1
```

## P8 evidence source shift

```text
p8_no_longer_uses_fixture_as_only_evidence_source = true
p8_must_read_real_raw_samples_or_source_index = true
p8_fixture_outputs_are_reference_shape_only = true
p8_real_evidence_window_required_before_state_estimate = true
```

## Window concepts frozen in P8-00

```text
evidence_window = historical observations used for state estimate
prediction_window = future target window produced from the state estimate
actual_observation_window = later real observations used only for backtest
```

## Initial window values

```text
evidence_window_start_ts = 2009-06-09T00:00:00.000Z
evidence_window_end_ts = 2009-06-09T04:00:00.000Z
prediction_window_start_ts = 2009-06-09T05:00:00.000Z
prediction_window_end_ts = 2009-06-09T07:00:00.000Z
actual_observation_window_start_ts = 2009-06-09T05:00:00.000Z
actual_observation_window_end_ts = 2009-06-09T07:00:00.000Z
expected_interval_ms = 3600000
```

## Read-only and no-write rules

```text
p8_database_access = read_only
p8_writes_facts = false
p8_writes_field_memory = false
p8_writes_model_state = false
p8_creates_execution_object = false
p8_creates_ao_act_task = false
p8_creates_dispatch = false
p8_creates_receipt = false
p8_creates_audit = false
p8_changes_frontend = false
p8_creates_server_route = false
p8_changes_db_schema = false
p8_changes_seed = false
p8_opens_auto_learning_loop = false
```

## P8 out of scope

```text
automatic_prescription
automatic_execution
field_memory_write
model_update
ao_act_task_creation
dispatch_creation
receipt_creation
audit_creation
frontend_authority
dashboard_authority
yield_or_profit_commitment
automatic_learning
```

## Forbidden directories in P8-00

```text
apps/web/
apps/server/
apps/executor/
packages/
db/
migrations/
scripts/twin_kernel/
scripts/demo_seed/
scripts/runtime/
```

## Changed files allowed in P8-00

```text
docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md
scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs
```

## Acceptance assertions

```text
p7_completion_tag_exists = true
p8_scope_explicitly_opened = true
one_problem_only = true
one_project_only = true
one_group_only = true
one_sensor_only = true
one_metric_kind_only = true
three_window_concepts_defined = true
read_only_db_rule_exists = true
no_frontend_rule_exists = true
no_execution_rule_exists = true
no_field_memory_rule_exists = true
no_model_write_rule_exists = true
no_seed_rule_exists = true
next_step_is_p8_01 = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING
p7_completion_tag_verified = true
fixed_scope_verified = true
window_concept_count = 3
read_only_rule_count = 14
out_of_scope_count = 12
changed_file_count = 2
next_step = P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
```

## Next step

```text
P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
```
