# docs/tasks/P11-06-Rollback-Supersession-Policy-v1.md

## Status

```text
Status: active P11 task
Task: P11-06 Rollback / Supersession Policy v1
Policy: docs/twin_kernel/ROLLBACK_SUPERSESSION_POLICY_V1.json
Acceptance: scripts/governance_acceptance/P11_06_ROLLBACK_SUPERSESSION_POLICY_V1_ACCEPTANCE.cjs
```

## Purpose

Define append-only future rollback and supersession behavior.

## Boundary

P11 defines the state machine but does not persist, retract, supersede, or delete objects.
