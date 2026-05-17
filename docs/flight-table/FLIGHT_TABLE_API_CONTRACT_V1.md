# Flight Table API Contract V1

## Status

Flight Table API V1 is an internal dev-only API family. It is disabled by default and must never be enabled as part of the ordinary customer release path.

Base path:

```text
/api/v1/dev/flight-table
```

Feature flag:

```text
ENABLE_FLIGHT_TABLE_API=true
```

Required scope for V1:

```text
security.admin
```

A future `dev.flight_table.run` scope may replace or complement `security.admin`, but it is not assumed by V1.

## Disabled response

When the feature flag is absent or false, every endpoint must return:

```json
{
  "ok": false,
  "error": "FLIGHT_TABLE_DISABLED"
}
```

The HTTP status used by V1 is `503`.

## Core endpoints

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

## Object assembly endpoints

```text
POST /api/v1/dev/flight-table/runs/:runId/field
POST /api/v1/dev/flight-table/runs/:runId/field-geometry
GET  /api/v1/dev/flight-table/device-templates
GET  /api/v1/dev/flight-table/formal-scenarios
POST /api/v1/dev/flight-table/runs/:runId/devices
POST /api/v1/dev/flight-table/runs/:runId/skills/bind
POST /api/v1/dev/flight-table/runs/:runId/skills/fail-one
POST /api/v1/dev/flight-table/runs/:runId/skills/restore
```

## Run and lane endpoints

```text
POST /api/v1/dev/flight-table/runs/:runId/start
POST /api/v1/dev/flight-table/runs/:runId/telemetry/publish
POST /api/v1/dev/flight-table/runs/:runId/telemetry/verify
POST /api/v1/dev/flight-table/runs/:runId/decision/run
POST /api/v1/dev/flight-table/runs/:runId/operation/run
POST /api/v1/dev/flight-table/runs/:runId/evidence/run
POST /api/v1/dev/flight-table/runs/:runId/report-learning/run
```

## Create run request

```json
{
  "run_id": "ft_20260510_001",
  "tenant_id": "tenantA",
  "project_id": "projectA",
  "group_id": "groupA",
  "lane": "success"
}
```

Allowed lane values:

```text
success
evidence_insufficient
weather_interference
skill_failure
all
```

## Run response

Every run response must include a run object:

```ts
type FlightTableRunV1 = {
  run_id: string;
  status: "DRAFT" | "READY" | "RUNNING" | "PASS" | "FAIL" | "CLEANED";
  lane: "success" | "evidence_insufficient" | "weather_interference" | "skill_failure" | "all";
  tenant_id: string;
  project_id: string;
  group_id: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  current_step?: string;
  steps: FlightTableStepV1[];
  manifest: FlightTableManifestV1;
  verify_summary: FlightVerifySummaryV1;
};
```

## Manifest contract

The manifest is the run-level object ledger. It must include:

```ts
type FlightTableManifestV1 = {
  field_id: string | null;
  season_id: string | null;
  crop: string | null;
  crop_stage: string | null;
  geometry_id: string | null;
  device_ids: string[];
  credential_ids: CredentialRef[];
  skill_binding_ids: string[];
  skill_run_ids: string[];
  recommendation_ids: string[];
  prescription_ids: string[];
  approval_request_ids: string[];
  operation_plan_ids: string[];
  act_task_ids: string[];
  receipt_ids: string[];
  evidence_ids: string[];
  acceptance_ids: string[];
  evidence_export_job_ids: string[];
  roi_ids: string[];
  field_memory_ids: string[];
  api_snapshot_refs: FlightTableApiSnapshotRefV1[];
  ui_urls: string[];
};
```

Credential references must be masked:

```ts
type CredentialRef = {
  credential_id: string;
  status: string;
  issued_at?: string;
  masked_secret: "****";
};
```

No endpoint may return raw credential secret, token, private key, or raw credential payload.

## Report and learning contract

FT-J report-learning verifies formal report and learning surfaces:

```text
GET /api/v1/reports/operation/:operation_id
GET /api/v1/reports/field/:field_id
GET /api/v1/customer/reports
GET /api/v1/weather/history?field_id=&from=&to=
GET /api/v1/weather/forecast?field_id=
GET /api/v1/operator/roi-ledger
GET /api/v1/customer/roi-ledger?field_id=&operation_id=
GET /api/v1/field-memory
GET /api/v1/fields/:field_id/memory
GET /api/v1/operations/:operation_id/field-memory
GET /api/v1/field-memory/health
GET /api/v1/operator/field-memory
GET /api/v1/operator/skill-traces?operation_id=...
GET /api/v1/operator/skill-performance?operation_id=...&field_id=...
```

The flight-table API may summarize these probes, but it must not replace the formal customer/operator APIs.

## Weather contract

When weather provider/location are unavailable or stub-only, the API must expose that state explicitly using status/source fields. It must not fabricate real weather.

## Evidence and acceptance contract

Receipt success is not acceptance pass. Acceptance pass must come from the formal acceptance path. Evidence-insufficient lanes must never present a pass verdict.

## Release gate commands

```bash
pnpm --filter @geox/server run smoke:flight-table
pnpm --filter @geox/server run smoke:flight-table:success
pnpm --filter @geox/server run smoke:flight-table:all
```


## Formal scenario definitions endpoint

```text
GET /api/v1/dev/flight-table/formal-scenarios
```

Response shape:

```json
{
  "ok": true,
  "source": "formal_scenario_lanes_v1",
  "scenarios": [
    {
      "scenario_type": "FORMAL_IRRIGATION",
      "lane": "positive",
      "label": "Formal irrigation positive closed loop",
      "release_gate": true,
      "flight_table_visible": true
    }
  ]
}
```

This endpoint must read from `listFormalScenarioLaneDefinitionsV1()` and must not maintain a separate Flight Table taxonomy.
Flight Table and CLI governance/release gates share the same `scenario_type`, `lane`, `release_gate`, and `flight_table_visible` definitions.
