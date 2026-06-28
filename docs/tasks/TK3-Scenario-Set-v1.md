# docs/tasks/TK3-Scenario-Set-v1.md

# TK3 — Scenario Set v1

TK3 introduces the third formal Twin Kernel output object: `scenario_set_v1`.

This task converts a persisted `forecast_run_v1` into a deterministic set of comparable water-management scenarios. It does not select an option, rank an option, create a recommendation, request approval, create an action task, write ROI, write Field Memory, run calibration, produce forecast-error records, create learning candidates, or create decision cycles.

## Position in the Twin Kernel line

TK0 proved the repository baseline.

TK1 added `field_state_snapshot_v1`.

TK2 added `forecast_run_v1`.

TK3 adds `scenario_set_v1`.

TK3 answers only:

- which forecast run was used
- what baseline scenario exists
- what comparable option scenarios exist
- what comparison axes are available
- what constraints and assumptions apply
- whether the same input produces the same deterministic hash

TK3 does not answer which option should be selected. That belongs to a later human-in-the-loop decision path.

## Input boundary

TK3 may read only:

- `forecast_run_v1`

TK3 must not read raw telemetry, source indexes, or snapshot source rows directly. It must use the TK2 forecast run as the input boundary.

## Output object

`scenario_set_v1` is a persisted Twin Kernel scenario table.

Minimum required fields:

- `scenario_set_id`
- `forecast_run_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `scenario_model_version`
- `status`
- `input_refs_json`
- `baseline_scenario_json`
- `option_scenarios_json`
- `comparison_axes_json`
- `constraints_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## Scenario v1 scope

The first scenario set is intentionally narrow:

- domain: water-management scenarios only
- mandatory baseline: `NO_ACTION_BASELINE`
- options: bounded irrigation alternatives
- output: comparable scenario set, not a recommendation

It must not include yield forecasts, nitrogen forecasts, disease forecasts, price forecasts, profit forecasts, prescriptions, task payloads, dispatch records, approval records, or recommendation semantics.

## Hard boundaries

TK3 must not:

- insert into `decision_recommendation_index_v1`
- create recommendation facts
- create approval records
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create execution receipts
- write ROI records
- write Field Memory records
- write calibration records
- write forecast-error records
- write learning candidates
- write decision cycles

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK3_SCENARIO_SET_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK3_SCENARIO_SET_V1_ACCEPTANCE
field_state_snapshot_v1_present = true
forecast_run_v1_present = true
scenario_set_v1_present = true
no_action_baseline_present = true
no_forbidden_writes = true
```

## Done

TK3 is done when the repository has a scenario-set schema migration, a deterministic scenario-set builder, registered scenario-set routes, and a governance acceptance script proving that `scenario_set_v1` exists without creating recommendation, execution, ROI, Field Memory, calibration, forecast-error, learning, or decision-cycle objects.
