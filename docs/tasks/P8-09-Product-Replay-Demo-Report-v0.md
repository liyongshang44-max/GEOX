# docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md

## Purpose

P8-09 implements the product replay demo report for the P8 real-evidence closed-loop replay.

The report is the externally readable replay artifact. It explains, in product terms, what happened in the past evidence window, how the system estimated current state, how it predicted the holdout window, what real observations arrived later, what the error was, and what calibration candidates were produced.

This report is read-only explanatory output. It is not a dashboard authority, not a recommendation, not an action authorization, not an automatic learning loop, and not an execution object.

## Gate

```text
P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
```

## Entry conditions

```text
previous_gate = P8_08_REAL_CALIBRATION_REPORT_V1
previous_doc = docs/tasks/P8-08-Real-Calibration-Report-v1.md
previous_acceptance = scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
previous_next_step = P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
input_calibration_report_kind = real_calibration_report_v1
```

## Runtime files created in P8-09

```text
scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md
```

## Fixed replay scope

```text
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
problem = soil_moisture_state_estimation
```

## Input artifact chain

```text
real_evidence_window_v0
real_soil_moisture_state_estimate_v1
real_soil_moisture_prediction_run_v1
real_actual_observation_window_v0
real_backtest_error_report_v1
real_calibration_report_v1
```

## Output object kind

```text
product_replay_demo_report_v0
```

## Required output fields

```text
product_replay_demo_report_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
replay_method
generated_for_as_of_ts
demo_title
demo_summary
replay_timeline
artifact_chain
product_narrative
evidence_window_summary
state_estimate_summary
prediction_summary
actual_observation_summary
backtest_error_summary
calibration_summary
boundary_summary
acceptance_summary
evidence_refs
actual_refs
source_query_refs
trace_refs
read_only
determinism_hash
```

## Replay narrative sections

```text
past_evidence
state_estimate
prediction
actual_observations
error_and_calibration
boundary_statement
```

## Product demo boundary rules

```text
demo_may_read_all_previous_read_only_outputs
demo_must_preserve_artifact_chain
demo_must_preserve_evidence_refs
demo_must_preserve_actual_refs
demo_must_preserve_source_query_refs
demo_must_not_rank_fields
demo_must_not_assign_priority
demo_must_not_authorize_action
demo_must_not_claim_model_updated
```

## Runtime strict prohibitions

```text
no_dashboard_authority
no_recommendation
no_irrigation_advice
no_action_authorization
no_automatic_learning_loop
no_model_update
no_model_write
no_field_memory_write
no_fact_write
no_execution_object
no_dispatch
no_receipt
no_audit_write
no_database_mutation
no_frontend_change
no_server_route
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
p8_08_verified = true
product_replay_demo_verified = true
artifact_chain_complete = true
narrative_sections_complete = true
boundary_summary_present = true
calibration_not_applied = true
evidence_refs_preserved = true
actual_refs_preserved = true
source_query_refs_preserved = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW
```

## Next step

```text
P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW
```
