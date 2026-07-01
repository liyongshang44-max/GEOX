# docs/tasks/P25-12-Idempotency-Duplicate-Receipt-Changed-Payload-Conflict-Acceptance.md

Freezes P25 receipt idempotency.

P25 does not claim endpoint reuse. Runtime duplicate 409 proves only same idempotency key duplicate blocking. P25 gate must prewrite-block any existing same task plus same executor receipt, including different idempotency keys.

Acceptance:

- node scripts/governance_acceptance/P25_12_IDEMPOTENCY_DUPLICATE_RECEIPT_CHANGED_PAYLOAD_CONFLICT_ACCEPTANCE.cjs
