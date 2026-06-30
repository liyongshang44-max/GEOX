# docs/tasks/P10-01-Runtime-Reconciliation-Authority-Contract-v0.md

## Status

```text
Status: active P10 task
Phase: P10 Runtime Reconciliation Contract / Non-Persisted Candidate Adapter Proof
Task: P10-01 Runtime Reconciliation Authority Contract v0
Authority source: README_MIGRATION.md
Contract: docs/twin_kernel/RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_V0.md
Acceptance: scripts/governance_acceptance/P10_01_RUNTIME_RECONCILIATION_AUTHORITY_CONTRACT_ACCEPTANCE.cjs
```

## Purpose

Define the P10 authority boundary. P10 may prove candidate-envelope mapping, but it may not perform runtime convergence, persistence, server integration, dashboard authority, or execution authority.

## Required lines

```text
source_line = offline_real_evidence_replay_kernel
target_line = server_persisted_twin_kernel
intermediate_line = non_persisted_candidate_adapter_proof
```
