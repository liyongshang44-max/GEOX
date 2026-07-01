# docs/tasks/P25-04-AO-ACT-v1-Control-Plane-Receipt-Payload-Mapping-v0.md

Defines the P25 receipt payload mapping for the v1 receipt endpoint.

P25 maps P24 persisted task fields into receipt payload fields, carries P24 and P23 refs in meta, and runs its own exact-key semantic forbidden scan before endpoint invocation.

Acceptance:

- node scripts/governance_acceptance/P25_04_AO_ACT_V1_CONTROL_PLANE_RECEIPT_PAYLOAD_MAPPING_ACCEPTANCE.cjs
