# docs/twin_kernel/RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_V0.md

## Status

```text
Status: P10-01 authority contract
Phase: P10 Runtime Reconciliation Contract / Non-Persisted Candidate Adapter Proof
Authority source: README_MIGRATION.md
Acceptance: scripts/governance_acceptance/P10_01_RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_ACCEPTANCE.cjs
```

## Authority lines

```text
source_line = offline_real_evidence_replay_kernel
target_line = server_persisted_twin_kernel
intermediate_line = non_persisted_candidate_adapter_proof
```

## P10 authority flags

```text
candidate_envelope_only = true
persistence_allowed = false
server_runtime_adapter = false
server_route_adapter = false
database_adapter = false
dashboard_authority = false
execution_authority = none
```

## No silent crossing

```text
no_silent_crossing = true
kernel_lines_merged = false
runtime_surface_changed = false
```

P10 is an offline candidate-envelope proof only. It does not persist objects, authorize execution, dispatch, learn, or merge kernel lines.
