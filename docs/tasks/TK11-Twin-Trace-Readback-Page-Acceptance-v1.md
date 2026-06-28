# docs/tasks/TK11-Twin-Trace-Readback-Page-Acceptance-v1.md

## Purpose

TK11 adds and accepts a read-only Operator page for Twin Kernel trace readback.

The purpose is to verify that the UI can faithfully render the `twin_trace_v1_read_model` returned by:

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

TK11 is not a decision UI, not a recommendation UI, and not an execution UI.

## Route

```text
/operator/twin/traces/:decisionCycleId
```

Example:

```text
/operator/twin/traces/dc_65e118bfa18dbf5dd3bce8b9
```

## Boundary

The page must be read-only.

The page must not call POST, PUT, PATCH, or DELETE.

The page must not create snapshots, forecasts, scenarios, calibration records, learning candidates, decision cycles, recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

The page must not rank, prioritize, advise, approve, dispatch, or create a task.

The page may render identifiers, statuses, provenance classes, boundary flags, and missing formalization tokens that are already present in the trace response.

## Required display contract

The page must show:

1. `object_type = twin_trace_v1_read_model`.
2. `read_only = true`.
3. `write_ready = false`.
4. `downstream_write_ready = false`.
5. `entered_collected` provenance.
6. `system_derived` provenance.
7. `human_confirmed` provenance.
8. `pointer_refs` provenance.
9. All seven system-derived objects:
   - `field_state_snapshot_v1`
   - `forecast_run_v1`
   - `scenario_set_v1`
   - `calibration_replay_v1`
   - `forecast_error_v1`
   - `field_learning_candidate_v1`
   - `decision_cycle_v1`
10. `decision_cycle_v1.current_stage`.
11. `missing_formalization` tokens:
   - `ROI_FORMALIZATION_MISSING`
   - `FORMAL_FIELD_MEMORY_MISSING`
   - `H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL`
12. `forbidden_auto_writes_absent`.

## Acceptance command

```powershell
node scripts/frontend_acceptance/TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1.cjs
```

## Local runtime smoke

After static acceptance, run the web app and open:

```text
http://127.0.0.1:5173/operator/twin/traces/dc_65e118bfa18dbf5dd3bce8b9
```

Runtime preconditions:

1. Web dev server is running.
2. API server is running on the configured `VITE_API_BASE_URL` or default local API base.
3. The persisted TK10 chain exists in DB.
4. The user session allows access to the Operator shell.
