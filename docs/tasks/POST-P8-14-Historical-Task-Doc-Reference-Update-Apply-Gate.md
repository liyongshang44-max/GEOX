# docs/tasks/POST-P8-14-Historical-Task-Doc-Reference-Update-Apply-Gate.md

## Status

```text
Status: gate view
Previous gate: POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN_ACCEPTANCE
```

## Purpose

POST-P8-14 defines the gate required before any future reference update can be applied for:

```text
historical_task_doc
```

POST-P8-13 produced a plan covering 48 source files, 371 update plan items, and 585 exact references. This task records the conditions required before a later task may apply those updates.

This task does not move files. It does not delete files. It does not change references. It only creates a gate report.

## Input

```text
docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json
```

## Output

```text
docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json
```

## Commands

```powershell
node scripts/maintenance/POST_P8_14_DEFINE_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE.cjs
node scripts/governance_acceptance/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_ACCEPTANCE.cjs
```

## Expected result

```text
ok = true
selected_group = historical_task_doc
reference_update_file_count = 48
reference_update_plan_item_count = 371
reference_update_exact_reference_count = 585
apply_gate_open = false
reference_update_apply_allowed = false
failed_assertion_count = 0
```

## Next step

```text
POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_DRY_RUN
```
