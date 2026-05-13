# GEOX Flight Table Rig V1

Flight Table is an internal development and acceptance rig. It is not a customer/operator product page and must not be mounted into customer/operator navigation.

## A0 storage boundary

FT-A0 uses temporary filesystem storage under:

```text
tmp/flight_table/<run_id>/
```

Files written by A0:

```text
run.json
api_snapshots/<snapshot_id>.json
```

This is a V1 temporary persistence layer for development and acceptance only. It is not a production persistence layer and must be replaced by the planned tables before production use:

```text
flight_table_run_v1
flight_table_step_v1
flight_table_manifest_v1
flight_table_api_snapshot_v1
```

## Runtime boundary

The API is disabled by default. It only responds when:

```text
ENABLE_FLIGHT_TABLE_API=true
```

When disabled, every Flight Table endpoint returns:

```json
{ "ok": false, "error": "FLIGHT_TABLE_DISABLED" }
```

FT-A0 requires `security.admin`. The future `dev.flight_table.run` scope is intentionally not introduced in A0.

Sensitive device credential values must not be persisted into manifest or rendered in the frontend. Manifest credential refs may contain only:

```text
credential_id
status
issued_at
masked_secret = "****"
```

## A0 contract

The A0 route set is:

```text
POST /api/v1/dev/flight-table/runs
GET  /api/v1/dev/flight-table/runs
GET  /api/v1/dev/flight-table/runs/:runId
POST /api/v1/dev/flight-table/runs/:runId/verify
POST /api/v1/dev/flight-table/runs/:runId/clean
POST /api/v1/dev/flight-table/runs/:runId/steps/:stepKey/retry
GET  /api/v1/dev/flight-table/runs/:runId/manifest
GET  /api/v1/dev/flight-table/runs/:runId/verify-report
GET  /api/v1/dev/flight-table/runs/:runId/api-snapshots
```

A0 creates the run model, empty manifest, API snapshots, verify summary, and clean control. It does not create field/device/skill/operation/evidence objects; those are implemented in later FT phases.
