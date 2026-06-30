# docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md

## Status

```text
Status: P9-01 governance contract
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Authority source: README_MIGRATION.md
Domain reference: docs/twin_kernel/README.md
Acceptance: scripts/governance_acceptance/P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_ACCEPTANCE.cjs
```

## Purpose

This contract freezes the authority boundary between the two Twin Kernel lines before any replay registry, replay case manifest, model version manifest, artifact mapping contract, or persisted runtime convergence work begins.

P9-01 does not merge the two lines. P9-01 only declares their authority, allowed ownership, forbidden crossings, and future reconciliation requirement.

## Line 1

```text
line_id = server_persisted_twin_kernel
authority_class = production_persisted_runtime
runtime_shape = server API runtime plus persisted Twin Kernel database/read-model surface
primary_route_surface = apps/server/src/routes/v1/twin_kernel.ts
module_registry = apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
domain_code = apps/server/src/domain/twin_kernel/**
database_contract = apps/server/db/migrations/*twin* and related Twin Kernel migrations
acceptance_anchor = scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs
```

Allowed authority:

- Owns persisted server Twin Kernel objects.
- Owns API-facing Twin Kernel route semantics.
- Owns database-backed read model semantics.
- Owns production-shaped deterministic runtime traces.

Forbidden authority:

- MUST NOT import scripts/twin_kernel.
- MUST NOT depend on P8 local replay scripts.
- MUST NOT treat P8 stdout artifacts as persisted Twin Kernel database objects.
- MUST NOT authorize execution, dispatch, AO-ACT task creation, or Field Memory writes by default.
- MUST NOT perform automatic model update from calibration candidates.

## Line 2

```text
line_id = offline_real_evidence_replay_kernel
authority_class = offline_validation_replay
runtime_shape = local deterministic replay scripts
primary_scripts = scripts/twin_kernel/P8_*.cjs
primary_docs = docs/tasks/P8-*.md
completion_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
completion_tag = p8_real_evidence_closed_loop_demo_completion
main_merge_tag = p8_real_evidence_closed_loop_demo_main_merge
```

Allowed authority:

- Owns deterministic offline replay validation.
- Owns real-evidence replay chain semantics for the fixed P8 case.
- Owns generated replay artifact contracts for validation and demonstration.
- Owns manual deterministic acceptance for P8 replay.

Forbidden authority:

- MUST NOT import apps/server runtime modules.
- MUST NOT write database rows as replay runtime.
- MUST NOT write facts.
- MUST NOT write Field Memory.
- MUST NOT write model state.
- MUST NOT create execution objects.
- MUST NOT create AO-ACT tasks.
- MUST NOT claim frontend or dashboard authority.
- MUST NOT act as a production persisted Twin Kernel runtime.

## Non-equivalence rule

P8 artifacts are not persisted Twin Kernel objects.

Offline replay artifacts may become inputs to a future mapping contract, but they do not automatically become server runtime state, database records, model versions, Field Memory entries, recommendations, execution objects, AO-ACT tasks, dispatches, or receipts.

## No silent crossing rule

No silent crossing between the two Twin Kernel lines is allowed.

Any future task that touches both lines must first introduce an explicit reconciliation contract covering:

```text
source_data_contract
artifact_mapping
model_version_mapping
case_manifest
persistence_policy
read_only_vs_write_boundary
acceptance_entrypoint
```

## P9 sequencing rule

P9-01 must complete before:

- P9-02 Replay Registry v0
- P9-03 Replay Case Manifest v0
- P9-04 Model Version Manifest v0
- P9-05 Acceptance Entry Unification
- P9-06 Replay Artifact Mapping Contract v0
- P9-07 Twin Kernel Convergence Completion Review

P9-01 does not create a replay registry, replay case manifest, model version manifest, or artifact mapping contract.

## Hard boundaries

```text
no_runtime_code_change
no_server_route_change
no_frontend_change
no_database_migration
no_seed_change
no_replay_algorithm_change
no_prediction_algorithm_change
no_db_write
no_fact_write
no_field_memory_write
no_model_update
no_ao_act_task
no_dispatch
no_receipt
no_dashboard_authority
```
