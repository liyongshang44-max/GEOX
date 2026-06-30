# docs/tasks/P11-03-Idempotency-Policy-v1.md

## Status

```text
Status: active P11 task
Task: P11-03 Idempotency Policy v1
Policy: docs/twin_kernel/IDEMPOTENCY_POLICY_V1.json
Acceptance: scripts/governance_acceptance/P11_03_IDEMPOTENCY_POLICY_V1_ACCEPTANCE.cjs
```

## Purpose

Define future duplicate/conflict behavior using deterministic identity and payload hashes.

## Boundary

P11 generates only future idempotency keys in dry-run output. It performs no write and no deduplication mutation.
