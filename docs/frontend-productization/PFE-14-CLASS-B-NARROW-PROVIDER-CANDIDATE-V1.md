# PFE-14 Class-B Narrow Operational Provider Candidate v1

Status: IMPLEMENTED CANDIDATE / NOT QUALIFIED / S4 NOT EFFECTIVE

This candidate additively extends the existing exact-Scope GET `/runtime/operational-summary`. It does not create a route, write facts, mutate scheduler state, alter KBS policy, or authorize frontend consumption.

Added server-owned fields are exactly `runtime_degradation_status`, `degradation_reason_codes`, `forecast_status`, `scenario_source_eligible`, and `slot_window`.

`runtime_degradation_status` uses persisted checkpoint existence plus server Evidence freshness and scheduler lag. Missing checkpoint/boundary produces `UNAVAILABLE` with missing-prerequisite reason codes only.

`forecast_status` is read from the already-validated persisted next-tick canonical Forecast snapshot. `scenario_source_eligible` uses CAP07 Runtime attachment semantics and stays null when the server cannot establish the product verdict.

`slot_window` is exactly 24 entries from persisted schedule start and O00–O23. Persisted states are copied exactly. Absent rows are `NOT_MATERIALIZED` only.

Still absent: Runtime Context binding, missed-slot count, backfill status, State normalized status, refresh policy, Runtime stage, tick-start, restart and recovery.
