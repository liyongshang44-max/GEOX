# Telemetry Observation Pipeline (v1)

## Pipeline contract

`raw_telemetry_v1 -> normalize(metric/unit/name) -> quality/confidence -> device_observation_v1`

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

## Write-layer ownership

- Observation ingest writes must go through `apps/server/src/services/device_observation_service_v1.ts`.
- The service centralizes:
  - facts append (`facts.record_json.type = device_observation_v1`)
  - idempotency key generation
  - field normalization
  - contracts schema validation (`@geox/contracts`)
