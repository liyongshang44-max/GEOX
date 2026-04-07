# Telemetry Observation Pipeline (v1)

## Pipeline contract

`raw_telemetry_v1 -> normalize -> device_observation_v1`

- `raw_telemetry_v1` is **ingress raw layer only** (audit/replay evidence).
- Dashboard / agronomy / business reads **must not** consume `raw_telemetry_v1` directly.
- Business reads should consume normalized `device_observation_v1` (ledger fact + `device_observation_index_v1` projection).

## Normalization output

`device_observation_v1` writes the following core fields:

- `metric`
- `value`
- `unit`
- `quality_flags`
- `confidence`
- `observed_at_ts_ms`
- dimensions: `tenant_id`, `project_id`, `group_id`, `device_id`, `field_id`
