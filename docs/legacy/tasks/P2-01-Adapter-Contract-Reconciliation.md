# docs/tasks/P2-01-Adapter-Contract-Reconciliation.md

## Purpose

P2-01 reconciles the executor adapter contract before any real adapter pilot.

P2-00 recorded that the repository had two adapter shapes. The contracts package described a historical dispatch-style adapter, while the executor runtime uses an execute-style adapter.

P2-01 makes the runtime execute-style contract canonical and keeps the older shape only as an explicitly named legacy bridge.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-01 Adapter Contract Reconciliation
```

## Scope

```text
packages/contracts/src/schema/executor_adapter_v1.ts
apps/executor/src/adapters/index.ts
apps/executor/src/adapters/irrigation_real_adapter.ts
apps/executor/src/adapters/irrigation_http_v1.ts
apps/executor/src/adapters/irrigation_simulator.ts
apps/executor/src/adapters/mqtt.ts
docs/tasks/P2-01-Adapter-Contract-Reconciliation.md
scripts/governance_acceptance/P2_01_ADAPTER_CONTRACT_RECONCILIATION.cjs
```

## Canonical decision

```text
Canonical adapter type: ExecutorAdapterV1
Canonical runtime method: execute(task)
Canonical support input: string | AoActTaskV1
Canonical validation method: validate(task)
Legacy bridge type: LegacyDispatchExecutorAdapterV1
```

## Runtime alignment

```text
apps/executor/src/adapters/index.ts mirrors the canonical contract.
apps/executor/src/adapters/registry.ts remains the registry entry point.
apps/executor/src/run_dispatch_once.ts remains the runtime caller of adapter.execute(task).
```

## Support input alignment

```text
AdapterSupportInput = string | AoActTask
ExecutorAdapterSupportInputV1 = string | AoActTaskV1
```

The following adapters accept the common support input shape:

```text
irrigation_real
irrigation_http_v1
irrigation_simulator
mqtt
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
node scripts/governance_acceptance/P2_01_ADAPTER_CONTRACT_RECONCILIATION.cjs
```

## Expected result

```text
ok = true
acceptance = P2_01_ADAPTER_CONTRACT_RECONCILIATION
canonical_execute_contract_verified = true
legacy_dispatch_bridge_preserved = true
runtime_adapter_contract_aligned = true
adapter_support_input_aligned = true
no_live_adapter_started = true
next_step = P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT
```
