# docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md

## Purpose

P2-04 freezes the boundary between production ingestion and executor adapter integration.

The production ingestion route may ingest production-shaped source refs and create a Twin Kernel decision-cycle mapping object. It must not create downstream execution, receipt, acceptance, ROI, Field Memory, or model-update objects.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-04 Production Ingestion Adapter Boundary
```

## Entry condition

```text
P2-00 Real Adapter Integration Planning and Boundary Inventory is complete.
P2-01 Adapter Contract Reconciliation is complete.
P2-02 Adapter Capability Manifest and Registry Audit is complete.
P2-03 Safe Real Adapter Sandbox Harness is complete.
tag: p2_03_safe_real_adapter_sandbox_harness
next_step from P2-03: P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY
```

## Scope

```text
docs/controlplane/GEOX-CP-ProductionIngestionAdapterBoundary-v1.json
docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md
scripts/governance_acceptance/P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY.cjs
```

P2-04 does not change the route implementation.

## Route under boundary

```text
apps/server/src/routes/v1/twin_kernel_production_ingestion.ts
POST /api/v1/twin-kernel/production-ingestion/source-refs
```

## Allowed writes

```text
production_ingestion_event_v0
decision_cycle_v1
```

## Pointer-only refs

The route may map source refs into decision-cycle external refs, but they remain pointers only:

```text
recommendation_id
approval_id
operation_plan_id
act_task_id
receipt_id
as_executed_id
acceptance_id
post_irrigation_verification_id
```

The following fields remain explicitly non-created by this boundary:

```text
roi_entry_id = null
field_memory_id = null
```

## Required response flags

```text
downstream_write_ready = false
automatic_business_decision_created = false
automatic_recommendation_created = false
automatic_approval_created = false
automatic_task_created = false
automatic_receipt_created = false
automatic_acceptance_created = false
automatic_roi_created = false
automatic_field_memory_created = false
model_update_created = false
```

## Forbidden coupling family

```text
No executor registry coupling.
No adapter factory coupling.
No dispatch loop coupling.
No broker coupling.
No live device coupling.
```

## Boundary

```text
No adapter invocation.
No live device integration.
No broker connection.
No executor runtime start.
No new route.
No DB migration.
No table schema change.
No UI.
No scheduler.
No priority logic.
No retry policy change.
No autonomous execution.
No automatic recommendation.
No automatic approval.
No automatic AO-ACT task creation.
No automatic receipt creation.
No automatic acceptance creation.
No automatic ROI creation.
No automatic Field Memory creation.
No model update.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY.cjs
```

## Expected result

```text
ok = true
acceptance = P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY
production_ingestion_boundary_manifest_verified = true
allowed_write_surface_verified = true
pointer_only_refs_verified = true
forbidden_adapter_coupling_absent = true
no_live_adapter_started = true
next_step = P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX
```
