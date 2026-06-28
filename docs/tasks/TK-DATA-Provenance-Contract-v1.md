# docs/tasks/TK-DATA-Provenance-Contract-v1.md

# TK-DATA — Twin Kernel Data Provenance Contract v1

This contract fixes the missing boundary between data that must be entered or collected, data that may be system-derived by the Twin Kernel, data that requires human confirmation, and downstream objects that may only be referenced by pointer.

It corrects the gap left by TK0–TK6: formal objects exist, but the repository must also make clear which fields are inputs and which fields are kernel outputs.

## Purpose

The Twin Kernel must not become a place where pages or callers directly fill derived results. A caller may provide scope, identifiers, formal references, and external observations. The kernel must derive state, forecast, scenario comparison, calibration error, learning candidate, and decision-cycle state from those inputs.

## Provenance classes

### 1. Entered / collected data

These records cannot be invented by the Twin Kernel:

- field identity and scope: `tenant_id`, `project_id`, `group_id`, `field_id`, crop/season/boundary metadata
- source index records: `field_index_v1`, `water_state_estimate_index_v1`, `soil_moisture_sensing_window_index_v1`, `weather_forecast_index_v1`
- sensor observations and quality flags
- weather observations and forecasts from an external source
- operation plan records and approval records
- AO-ACT or `/api/v1/actions/*` task records
- receipts and as-executed records
- acceptance results
- H56 water response verification records
- ROI source records and cost/value evidence
- H58 formal Field Memory evidence and formal acceptance chain records

The Twin Kernel may read or reference these records. It must not fabricate them.

### 2. System-derived Twin Kernel data

These records are kernel outputs:

- `field_state_snapshot_v1`
- `forecast_run_v1`
- `scenario_set_v1`
- `calibration_replay_v1`
- `forecast_error_v1`
- `field_learning_candidate_v1`
- `decision_cycle_v1`

Their derived result fields must be produced by builders, not by request body passthrough.

### 3. Human-confirmed data

These require a human or formal lane confirmation:

- recommendation approval decision
- operation plan confirmation
- dispatch authorization
- acceptance verdict
- manual review result
- formal evidence confirmation
- ROI formalization decision
- Field Memory formalization decision

The kernel may show missing gates and pointer refs. It must not confirm these itself.

### 4. Pointer refs only

The following identifiers may be referenced by `decision_cycle_v1`, but must not be created by the Twin Kernel route family:

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

## Object-level provenance matrix

### `field_state_snapshot_v1`

Allowed caller inputs:

- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `season_id`
- `as_of_ts`

Allowed source reads:

- `field_index_v1`
- `water_state_estimate_index_v1`
- `soil_moisture_sensing_window_index_v1`
- `weather_forecast_index_v1`

System-derived fields:

- `snapshot_id`
- `status`
- `state_vector_json`
- `confidence_json`
- `evidence_refs_json`
- `source_indexes_json`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `state_vector_json`
- `confidence_json`
- `source_indexes_json`
- `blocking_reasons_json`
- `determinism_hash`

### `forecast_run_v1`

Allowed caller inputs:

- `snapshot_id`
- `model_version`

Allowed source reads:

- `field_state_snapshot_v1`

System-derived fields:

- `forecast_run_id`
- `horizon_days`
- `status`
- `input_refs_json`
- `forecast_points_json`
- `risk_timeline_json`
- `uncertainty_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `forecast_points_json`
- `risk_timeline_json`
- `uncertainty_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`

### `scenario_set_v1`

Allowed caller inputs:

- `forecast_run_id`
- `scenario_model_version`

Allowed source reads:

- `forecast_run_v1`

System-derived fields:

- `scenario_set_id`
- `status`
- `input_refs_json`
- `baseline_scenario_json`
- `option_scenarios_json`
- `comparison_axes_json`
- `constraints_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `baseline_scenario_json`
- `option_scenarios_json`
- `comparison_axes_json`
- `constraints_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`

### `calibration_replay_v1` and `forecast_error_v1`

Allowed caller inputs:

- `scenario_set_id`
- `selected_option_id`
- external observed payload only when it represents a real post-action observation or verification evidence
- `observed_at`
- `post_soil_moisture_percent`
- `observed_water_state`
- `verification_ref_id`
- `evidence_refs`

Preferred formal source:

- H56 `water_response_verification_index_v1` or equivalent formal verification lane

Allowed source reads:

- `scenario_set_v1`
- `forecast_run_v1`

System-derived fields:

- `calibration_replay_id`
- `forecast_error_id`
- `input_refs_json`
- `predicted_json`
- `observed_json` alignment
- `error_summary_json`
- `reason_candidates_json`
- `error_metric`
- `error_value`
- `error_direction`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `predicted_json`
- `observed_json`
- `error_summary_json`
- `reason_candidates_json`
- `error_metric`
- `error_value`
- `error_direction`
- `blocking_reasons_json`
- `determinism_hash`

### `field_learning_candidate_v1`

Allowed caller inputs:

- `forecast_error_id`
- formal gate refs
- `acceptance_id`
- `post_irrigation_verification_id`
- `formal_evidence_ref_id`
- `evidence_refs`

Allowed source reads:

- `forecast_error_v1`
- `calibration_replay_v1`
- H58 formal Field Memory boundary document

System-derived fields:

- `field_learning_candidate_id`
- `candidate_status`
- `learning_scope`
- `learning_statement_json`
- `supporting_evidence_refs_json`
- `counter_evidence_refs_json`
- `confidence_json`
- `formal_gate_refs_json`
- `h58_gate_status_json`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `learning_statement_json`
- `supporting_evidence_refs_json`
- `counter_evidence_refs_json`
- `confidence_json`
- `h58_gate_status_json`
- `blocking_reasons_json`
- `determinism_hash`
- `learning_eligible`
- `customer_visible_memory`

### `decision_cycle_v1`

Allowed caller inputs:

- `field_learning_candidate_id`
- pointer refs only: `recommendation_id`, `approval_id`, `operation_plan_id`, `act_task_id`, `receipt_id`, `as_executed_id`, `acceptance_id`, `post_irrigation_verification_id`, `roi_entry_id`, `field_memory_id`

Allowed source reads:

- `field_learning_candidate_v1`
- `forecast_error_v1`
- `calibration_replay_v1`
- `scenario_set_v1`
- `forecast_run_v1`
- `field_state_snapshot_v1`

System-derived fields:

- `decision_cycle_id`
- `cycle_status`
- `current_stage`
- `external_refs_json`
- `state_machine_json`
- `human_gate_json`
- `boundary_flags_json`
- `blocking_reasons_json`
- `determinism_hash`

Forbidden caller-supplied fields:

- `cycle_status`
- `current_stage`
- `state_machine_json`
- `human_gate_json`
- `boundary_flags_json`
- `blocking_reasons_json`
- `determinism_hash`
- `automatic_task_created`

## Route boundary

The `/api/v1/twin-kernel/*` route family may accept only:

- scope fields
- object IDs
- model version labels
- observed evidence payloads
- formal gate refs
- external pointer refs

It must not accept precomputed derived payloads such as `forecast_points_json`, `risk_timeline_json`, `learning_statement_json`, `state_machine_json`, or `determinism_hash`.

## Builder boundary

Every Twin Kernel builder must derive its object ID and `determinism_hash` from canonical input. A caller must never provide either field as a trusted input.

## Downstream boundary

The Twin Kernel route family must not create or mutate:

- formal Field Memory
- ROI records
- recommendations
- approvals
- operation plans
- tasks
- dispatch records
- receipts
- acceptance records
- model parameters

Those may appear only as formal source records or pointer refs.

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK_DATA_PROVENANCE_CONTRACT_V1.cjs
```

Expected result:

```text
ok = true
acceptance = TK_DATA_PROVENANCE_CONTRACT_V1
request_body_derived_passthrough_blocked = true
determinism_hash_user_input_blocked = true
builder_hash_derivation_present = true
downstream_write_boundary_preserved = true
```
