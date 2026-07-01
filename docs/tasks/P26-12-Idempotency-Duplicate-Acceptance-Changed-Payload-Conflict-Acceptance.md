# docs/tasks/P26-12-Idempotency-Duplicate-Acceptance-Changed-Payload-Conflict-Acceptance.md

Freezes P26 acceptance result idempotency.

P26 gate must prewrite-block an existing same receipt review and must block different idempotency keys or changed payloads for the same receipt. Endpoint reuse is not claimed.

Acceptance:

- node scripts/governance_acceptance/P26_12_IDEMPOTENCY_DUPLICATE_ACCEPTANCE_CHANGED_PAYLOAD_CONFLICT_ACCEPTANCE.cjs
