# P41 Live Evidence Ingestion SLA / Runtime Input Contract v0

P41 creates a controlled runtime input contract evaluation gate.

P41 consumes P40-governed schedule/tick/cycle refs and pointer-only evidence refs, resolves deterministic live evidence windows, evaluates freshness, coverage, sensor/metric/time gaps, late/out-of-order/duplicate handling, and atomically writes only the four live input report records in controlled-write mode.

P41 does not create evidence, ingest evidence, poll sensors, run a daemon, define production uptime SLA, create state estimates, create active forecasts, compute residuals, detect drift, update or activate models, create recommendations, create actions, create AO-ACT, create ROI, create Field Memory, or create learning signals.

Allowed local target records:

- `live_evidence_ingestion_window_v1`
- `runtime_input_sufficiency_report_v1`
- `sensor_gap_report_v1`
- `evidence_freshness_report_v1`

Baseline: `p40_production_twin_runtime_scheduler_gate_v0_closure` at `1ab084161d4b0a1c9812055483c3604067a8e878`.

Acceptance:

```text
node scripts/twin_kernel/P41_ALL_ACCEPTANCE_CHECK.cjs
node scripts/twin_kernel/P41_25_CHECK.cjs
```
