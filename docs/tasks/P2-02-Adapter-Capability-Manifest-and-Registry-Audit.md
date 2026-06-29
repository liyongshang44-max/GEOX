# docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md

## Purpose

P2-02 adds a machine-readable capability manifest for the executor adapter registry.

The goal is to make registered adapter types, supported actions, required fields, runtime context, and negative guards explicit before any safe sandbox or real adapter pilot work begins.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-02 Adapter Capability Manifest and Registry Audit
```

## Entry condition

```text
P2-00 Real Adapter Integration Planning and Boundary Inventory is complete.
P2-01 Adapter Contract Reconciliation is complete.
tag: p2_01_adapter_contract_reconciliation
next_step from P2-01: P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT
```

## Scope

```text
docs/controlplane/GEOX-CP-ExecutorAdapterCapabilityManifest-v1.json
docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md
scripts/governance_acceptance/P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT.cjs
```

## Registry inventory

The manifest records these registered adapter types:

```text
irrigation_real
irrigation_simulator
mqtt
irrigation_http_v1
```

The registry source remains:

```text
apps/executor/src/adapters/registry.ts
```

## Capability inventory

Each manifest entry records:

```text
adapter_type
factory
source_file
capabilities
supported_action_types
support_input
required_task_fields
required_runtime_context
negative_checks
live_effect_boundary
```

## Required negative checks

The manifest and acceptance verify these guard families:

```text
missing_adapter_type
unknown_adapter_type
duplicate_adapter_type
unsupported_action_type
adapter_validate_failed
missing_outbox_fact_id
missing_device_id
missing_topic
missing_operation_plan_id
publish_failed
http_error
```

## Boundary

```text
No live device integration.
No broker connection is attempted by this task.
No production credential is introduced.
No cloud deployment.
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
node scripts/governance_acceptance/P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT.cjs
```

## Expected result

```text
ok = true
acceptance = P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT
manifest_schema_verified = true
registry_manifest_coverage_verified = true
adapter_source_negative_checks_verified = true
runtime_dispatch_guard_verified = true
no_live_adapter_started = true
next_step = P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS
```
