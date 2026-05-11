# Flight Table Rig V1

## Purpose

Flight Table Rig V1 turns GEOX's field-operation chain into a repeatable internal acceptance rig. It is designed for development, integration, demo rehearsal, and delivery acceptance. It is not a production customer or operator module.

The rig validates whether a field can move from observation to diagnosis, decision, approval, execution, evidence, acceptance, report, and learning closure.

## Route and UI boundary

Frontend route:

```text
/dev/flight-table
```

Backend route family:

```text
/api/v1/dev/flight-table/*
```

The route may be registered in the internal app router, but it must not be placed into customer or operator formal navigation.

## Run model

A run is the root object of the rig.

Core fields:

```ts
type FlightTableRunV1 = {
  run_id: string;
  status: "DRAFT" | "READY" | "RUNNING" | "PASS" | "FAIL" | "CLEANED";
  lane: "success" | "evidence_insufficient" | "weather_interference" | "skill_failure" | "all";
  tenant_id: string;
  project_id: string;
  group_id: string;
  current_step?: string;
  steps: FlightTableStepV1[];
  manifest: FlightTableManifestV1;
  verify_summary: FlightVerifySummaryV1;
};
```

## A-I chain

Flight Table V1 uses the A-I step model:

- A: run and object assembly baseline;
- B: field object;
- C: field geometry / GIS;
- D: device onboarding and sensing;
- E: recommendation, prescription, approval;
- F: operation, AO-ACT, dispatch, receipt, as-executed;
- G: evidence, acceptance, evidence export;
- H: report, weather, ROI, Field Memory, learning closure;
- I: final diagnostics / package review.

Every phase must expose status using:

```text
PENDING / RUNNING / PASS / FAIL / SKIPPED
```

## Lanes

The rig supports these lanes:

```text
success
evidence_insufficient
weather_interference
skill_failure
all
```

Lane expectations:

- `success`: should reach acceptance pass, report visibility, ROI or explicit estimate, Field Memory or explicit empty reason, and skill performance closure.
- `evidence_insufficient`: receipt may exist, but acceptance must not be presented as pass when evidence is missing.
- `weather_interference`: rainfall or weather interference must exclude learning from being treated as irrigation effect.
- `skill_failure`: the run must show failure or blocked trust, and must not write trusted learning.
- `all`: exercises multi-lane orchestration but must still preserve lane-level semantics.

## Manifest discipline

All core objects created or observed during the run must be recorded in the manifest:

- field_id
- season_id
- crop
- crop_stage
- geometry_id
- device_ids
- credential_ids
- skill_binding_ids
- skill_run_ids
- recommendation_ids
- prescription_ids
- approval_request_ids
- operation_plan_ids
- act_task_ids
- receipt_ids
- evidence_ids
- acceptance_ids
- evidence_export_job_ids
- roi_ids
- field_memory_ids
- api_snapshot_refs
- ui_urls

Credential references must contain only:

```ts
type CredentialRef = {
  credential_id: string;
  status: string;
  issued_at?: string;
  masked_secret: "****";
};
```

## API snapshots

Each phase must create or preserve an API snapshot when a meaningful action or verification occurs. Snapshots are not a substitute for formal storage, but they provide a run-level audit trail.

## Cleanup

The rig must support cleaning the current run:

```text
POST /api/v1/dev/flight-table/runs/:runId/clean
```

Cleaning marks the run as `CLEANED` and removes or invalidates run-scoped temporary artifacts according to the V1 storage model. It must not delete unrelated customer/operator production objects.
