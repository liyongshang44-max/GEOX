# docs/tasks/P9-05-Acceptance-Entry-Unification.md

## Status

```text
Status: active P9 governance task
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Task: P9-05 Acceptance Entry Unification
Authority source: README_MIGRATION.md
Line authority contract: docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md
Acceptance entrypoints manifest: docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json
Unified runner: scripts/acceptance/run_acceptance.cjs
Acceptance: scripts/governance_acceptance/P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE.cjs
```

## Purpose

P9-05 adds one unified P9 Twin Kernel acceptance entrypoint without removing the existing legacy acceptance runner behavior.

The unified entrypoint is:

```powershell
node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel
```

The list-only command is:

```powershell
node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel --list
```

## Unified suite

```text
suite_id = p9-twin-kernel
manifest = docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json
runner = scripts/acceptance/run_acceptance.cjs
default_suite_preserved = legacy
```

## Entrypoint order

```text
0 -> P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL
1 -> P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT
2 -> P9_02_REPLAY_REGISTRY_V0
3 -> P9_03_REPLAY_CASE_MANIFEST_V0
4 -> P9_04_MODEL_VERSION_MANIFEST_V0
5 -> P9_05_ACCEPTANCE_ENTRY_UNIFICATION
```

## Non-goals

```text
no_runtime_code_change
no_server_route_change
no_frontend_change
no_database_migration
no_seed_change
no_replay_algorithm_change
no_prediction_algorithm_change
no_training_run
no_model_state_write
no_model_update
no_calibration_application
no_field_memory_write
no_db_write
no_fact_write
no_ao_act_task
no_dispatch
no_receipt
no_persisted_twin_object_creation
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE.cjs
```

## Optional unified suite command

```powershell
node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel
```

## Expected acceptance result

```text
ok = true
acceptance = P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE
acceptance_entrypoints_manifest_present = true
unified_runner_supports_p9_suite = true
entrypoint_count = 6
list_command_contains_all_entrypoints = true
default_suite_preserved = legacy
runtime_surface_changed = false
failed_assertion_count = 0
```

## Next task

```text
P9-06 Replay Artifact Mapping Contract v0
```
