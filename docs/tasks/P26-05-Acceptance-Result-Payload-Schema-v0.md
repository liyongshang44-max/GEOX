# docs/tasks/P26-05-Acceptance-Result-Payload-Schema-v0.md

Defines the P26 `acceptance_result_v1` payload schema.

P26 uses the existing persisted verdict vocabulary: `PASS`, `FAIL`, `PARTIAL`, `NEEDS_REVIEW`, and `INSUFFICIENT_EVIDENCE`. `PENDING` and `NEEDS_FORMAL_ACCEPTANCE` are not persisted verdict values for P26.

Acceptance:

- node scripts/governance_acceptance/P26_05_ACCEPTANCE_RESULT_PAYLOAD_SCHEMA_ACCEPTANCE.cjs
