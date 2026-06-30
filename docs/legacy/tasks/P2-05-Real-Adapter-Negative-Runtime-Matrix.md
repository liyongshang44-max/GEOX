# docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md

## Purpose

P2-05 freezes the negative runtime matrix required before the operator-controlled pilot dry run.

The matrix confirms that real-adapter preparation has explicit failure behavior for registry errors, unsupported action checks, validation failures, HTTP sandbox rejection, HTTP sandbox transport error, and production-ingestion isolation.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-05 Real Adapter Negative Runtime Matrix
```

## Entry condition

```text
P2-00 Real Adapter Integration Planning and Boundary Inventory is complete.
P2-01 Adapter Contract Reconciliation is complete.
P2-02 Adapter Capability Manifest and Registry Audit is complete.
P2-03 Safe Real Adapter Sandbox Harness is complete.
P2-04 Production Ingestion Adapter Boundary is complete.
tag: p2_04_production_ingestion_adapter_boundary
next_step from P2-04: P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX
```

## Scope

```text
docs/controlplane/GEOX-CP-RealAdapterNegativeRuntimeMatrix-v1.json
scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs
docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md
scripts/governance_acceptance/P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX.cjs
```

## Runtime matrix target

```text
local-only matrix runner: scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs
sandbox dependency: scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs
bind host: 127.0.0.1
```

## Required case families

```text
registry_missing_adapter_type
registry_duplicate_adapter_type
registry_unknown_adapter_type
dispatch_unsupported_action
dispatch_adapter_validate_failed
irrigation_real_missing_outbox_fact
irrigation_real_missing_device
irrigation_real_capability_missing
mqtt_missing_outbox_fact
mqtt_missing_topic
mqtt_publish_failed
irrigation_http_missing_device
irrigation_http_missing_operation_plan
irrigation_http_device_reject
irrigation_http_transport_error
production_ingestion_has_no_adapter_coupling
```

## Runtime cases

The matrix runner executes these local sandbox cases:

```text
irrigation_http_missing_device -> MISSING_DEVICE_ID
irrigation_http_missing_operation_plan -> MISSING_OPERATION_PLAN_ID
irrigation_http_device_reject -> DEVICE_REJECT
irrigation_http_transport_error -> HTTP_ERROR
```

## Boundary

```text
Loopback only.
No live device integration.
No broker connection.
No GEOX server route call.
No DB mutation.
No new route.
No DB migration.
No table schema change.
No UI.
No scheduler.
No autonomous execution.
No automatic receipt creation.
No automatic acceptance creation.
No automatic ROI creation.
No automatic Field Memory creation.
No model update.
```

## Direct matrix command

```powershell
node scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX.cjs
```

## Expected result

```text
ok = true
acceptance = P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX
matrix_manifest_verified = true
matrix_runtime_verified = true
matrix_case_count = 16
runtime_case_count = 4
failed_case_count = 0
no_live_adapter_started = true
next_step = P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN
```
