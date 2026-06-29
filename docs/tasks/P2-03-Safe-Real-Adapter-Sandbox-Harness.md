# docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md

## Purpose

P2-03 adds a safe local sandbox harness for the real adapter path before any operator-controlled pilot.

The harness exercises the `irrigation_http_v1` request shape against a local stub bound to `127.0.0.1`. It validates adapter-like success and failure modes without connecting to a real device, broker, cloud service, GEOX server route, or database.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-03 Safe Real Adapter Sandbox Harness
```

## Entry condition

```text
P2-00 Real Adapter Integration Planning and Boundary Inventory is complete.
P2-01 Adapter Contract Reconciliation is complete.
P2-02 Adapter Capability Manifest and Registry Audit is complete.
tag: p2_02_adapter_capability_manifest_registry_audit
next_step from P2-02: P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS
```

## Scope

```text
scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs
docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md
scripts/governance_acceptance/P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS.cjs
```

## Sandbox target

```text
adapter_type: irrigation_http_v1
source contract reference: docs/controlplane/GEOX-CP-ExecutorAdapterCapabilityManifest-v1.json
source adapter reference: apps/executor/src/adapters/irrigation_http_v1.ts
sandbox bind host: 127.0.0.1
```

## Harness behavior

The harness starts a local HTTP server and sends adapter-shaped POST requests to:

```text
/device/<device_id>/irrigate
```

The sandbox validates this request shape:

```text
command_id
task_id
operation_plan_id
parameters
context
```

The sandbox runs these deterministic cases:

```text
accepted_command
device_reject
missing_device_id
missing_operation_plan_id
http_error
```

## Boundary

```text
No live device integration.
No broker connection.
No production credential.
No cloud deployment.
No GEOX server route call.
No DB mutation.
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

## Direct harness command

```powershell
node scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS.cjs
```

## Expected result

```text
ok = true
acceptance = P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS
sandbox_harness_static_verified = true
sandbox_harness_runtime_verified = true
sandbox_case_count = 5
live_device_connected = false
broker_connected = false
db_mutated = false
next_step = P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY
```
