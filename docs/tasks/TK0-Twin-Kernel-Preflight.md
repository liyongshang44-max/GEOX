# docs/tasks/TK0-Twin-Kernel-Preflight.md

# TK0 — Twin Kernel Preflight

TK0 freezes the repository baseline before implementing the Twin Kernel.

This task adds no product runtime behavior. It does not add migrations, routes, frontend pages, recommendations, approvals, action tasks, ROI writes, Field Memory writes, calibration execution, or learning algorithms.

## Capability baseline

The current repository has an Operator Twin workbench that reads scoped source index tables. The required source indexes are:

- field_index_v1
- water_state_estimate_index_v1
- soil_moisture_sensing_window_index_v1
- weather_forecast_index_v1
- irrigation_scenario_set_index_v1
- decision_recommendation_index_v1

The current repository also has boundaries for water response verification, ROI governance, Field Memory governance, and the action execution successor route family.

## Missing Twin Kernel objects

The current repository must not be treated as having the formal Twin Kernel until these objects exist as production persistence or write paths:

- field_state_snapshot_v1
- forecast_run_v1
- scenario_set_v1
- calibration_replay_v1
- forecast_error_v1
- field_learning_candidate_v1
- decision_cycle_v1

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK0_TWIN_KERNEL_PREFLIGHT_AUDIT.cjs
```

Expected result:

```text
ok = true
acceptance = TK0_TWIN_KERNEL_PREFLIGHT_AUDIT
next_step = TK1_FIELD_STATE_SNAPSHOT_V1
```

## Done

TK0 is done when the acceptance script proves the current baseline and confirms that the Twin Kernel objects are still missing.
