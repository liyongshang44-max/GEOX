# docs/tasks/P2-Real-Adapter-Integration-Planning.md

## Purpose

This document starts P2 Real Adapter Integration after P1 completion review.

P2 must integrate real adapter paths without breaking the Twin Kernel v1 boundaries established through POSTV1-01 through POSTV1-06. The first P2 task is planning and boundary inventory only. It does not connect a live device, start a production adapter, introduce production credentials, or authorize autonomous control.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
Current gate: P2_REAL_ADAPTER_INTEGRATION_PLANNING
```

## Entry condition

```text
P1 Production Hardening is complete.
P1 completion review is merged.
tag: p1_completion_review_before_p2
next_step from P1 review: P2_REAL_ADAPTER_INTEGRATION_PLANNING
```

## Second audit result

No existing P2 Real Adapter Integration PR was found.

No existing p2 branch was found.

The repository already contains adapter-related implementation assets:

```text
packages/contracts/src/schema/executor_adapter_v1.ts
apps/executor/src/adapters/index.ts
apps/executor/src/adapters/registry.ts
apps/executor/src/adapters/irrigation_real_adapter.ts
apps/executor/src/adapters/mqtt.ts
apps/executor/src/runtime_loop.ts
apps/executor/src/run_dispatch_once.ts
apps/executor/src/lib/claim.ts
docs/controlplane/GEOX-CP-AO-ACT-ExecutorAdapter-v0.md
apps/server/src/routes/v1/twin_kernel_production_ingestion.ts
```

## Important audit finding

There are two adapter contract shapes in the repository:

```text
packages/contracts ExecutorAdapterV1:
- adapter_type
- supports(action_type)
- validate(task)
- dispatch(task, ctx)
- optional pollReceipt(ctx)

apps/executor runtime Adapter:
- type
- adapter_type
- supports(action_type or task depending on implementation)
- validate(task)
- execute(task)
```

P2 must not proceed to live adapter execution until this contract mismatch is documented and reconciled or explicitly bridged.

## Existing execution chain facts

```text
apps/executor/src/runtime_loop.ts runs a supervised executor loop.
apps/executor/src/run_dispatch_once.ts claims dispatch work and finds adapters by adapter_type.
apps/executor/src/lib/claim.ts calls /api/v1/ao-act/dispatches/claim.
apps/executor/src/adapters/registry.ts registers irrigation_real, irrigation_simulator, mqtt, and irrigation_http_v1 adapters.
apps/executor/src/adapters/mqtt.ts publishes to MQTT and records a downlink fact through executor_api.
apps/executor/src/adapters/irrigation_real_adapter.ts validates outbox_fact_id and device_id before publishing a downlink record.
docs/controlplane/GEOX-CP-AO-ACT-ExecutorAdapter-v0.md explicitly says earlier executor adapter work was implementation-only and not new governance.
apps/server/src/routes/v1/twin_kernel_production_ingestion.ts explicitly forbids automatic recommendation, approval, task, receipt, acceptance, ROI, Field Memory, and model update side effects.
```

## P2 task line

```text
P2-00 Real Adapter Integration Planning and Boundary Inventory
P2-01 Adapter Contract Reconciliation
P2-02 Adapter Capability Manifest and Registry Audit
P2-03 Safe Real Adapter Sandbox Harness
P2-04 Production Ingestion Adapter Boundary
P2-05 Real Adapter Negative Runtime Matrix
P2-06 Operator-Controlled Pilot Dry Run
```

## P2-00 scope

This PR covers only:

```text
P2 entry condition check
existing adapter asset inventory
contract mismatch record
P2 task-line definition
P2 hard boundaries
static governance acceptance
```

## P2-00 boundary

```text
No live device integration.
No real broker credential.
No cloud deployment.
No new route.
No DB migration.
No schema change.
No UI.
No scheduler.
No priority logic.
No retry policy.
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

## P2-01 expected focus

```text
Document the canonical adapter contract for runtime and packages/contracts.
Decide whether packages/contracts should mirror runtime execute(task) or whether runtime should bridge to dispatch(task, ctx).
Verify supports and validate function signatures.
Require one compatibility acceptance before any real adapter pilot.
```

## P2-02 expected focus

```text
Inventory adapter types registered in apps/executor/src/adapters/registry.ts.
Require explicit capability mapping per adapter type.
Require negative checks for missing adapter_type, unsupported action_type, missing device_id, missing topic, and missing outbox_fact_id.
```

## P2-03 expected focus

```text
Create a safe sandbox harness for a real adapter path without live physical effect.
Prefer a local broker or local HTTP stub.
Require pointer-only raw external refs.
Require deterministic replayable output.
```

## P2-04 expected focus

```text
Define external source-event adapter boundary into production_ingestion_event_v0.
Preserve source_system plus source_event_id idempotency.
Preserve source_refs scalar-only rules.
Do not create downstream recommendation, approval, task, receipt, acceptance, ROI, Field Memory, or model update.
```

## P2-05 expected focus

```text
Negative runtime matrix for adapter integration.
Include auth failure, offline device or broker, unsupported action, malformed payload, missing topic, missing device, missing outbox_fact_id, duplicate source event, and wrong tenant/project/group isolation.
```

## P2-06 expected focus

```text
One operator-controlled pilot dry run.
Manual start only.
Explicit target only.
No automatic selection policy.
No production credentials in repo.
No autonomous operation.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P2_REAL_ADAPTER_INTEGRATION_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P2_REAL_ADAPTER_INTEGRATION_PLANNING
p1_review_verified = true
p2_task_count = 7
adapter_asset_count >= 8
contract_mismatch_recorded = true
no_live_adapter_started = true
next_step = P2_01_ADAPTER_CONTRACT_RECONCILIATION
```
