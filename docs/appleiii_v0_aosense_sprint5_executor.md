# Apple III v0 · Sprint 5 · Executor Client (Frozen)

Scope
- No contract change (AO_SENSE_TASK_v1 / AO_SENSE_RECEIPT_v1 unchanged).
- No state tables; selector remains read-only ledger join.
- Executor identity is audit evidence only, written as a `marker_v1` with a structured `note` prefix.

Deliverables
1) `scripts/EXECUTOR_AOSENSE_DEMO.ps1`
- Implements: poll `GET /api/control/ao_sense/next_task` → write executor audit marker → write receipt referencing marker.
- Uses retry to tolerate server warmup (`curl: (52)`).
- `-DryRun` supported (fetch-only).

2) `scripts/ACCEPTANCE_APPLEIII_EXECUTOR.ps1`
- Creates a task from Judge AO-SENSE.
- Asserts `next_task` returns it.
- Invokes executor client once.
- Asserts `next_task` becomes `204 No Content`.

Frozen audit encoding (no marker contract change)
- Marker is created via `POST /api/marker` (existing path).
- `note` must start with: `AO_SENSE_EXECUTION ` followed by a single-line JSON object:
  - `executor_kind`: `"human"` or `"device"`
  - `executor_id`: string
  - `task_id`: string (the AO_SENSE_TASK_v1.task_id)

Operational intent
- This sprint establishes a minimal "pull-execute-receipt" loop suitable for human or device agents,
  without implying identity guarantees, authorization, or agronomy/value judgment.