# docs/tasks/P25-13-Explicit-Control-Plane-Receipt-Persistence-Acceptance.md

Controlled-write acceptance for receipt persistence.

The target receipt fact, plan transition, and terminal plan update must be created only through the control-plane receipt endpoint, never direct SQL from the runner.

Acceptance:

- node scripts/governance_acceptance/P25_13_EXPLICIT_CONTROL_PLANE_RECEIPT_PERSISTENCE_ACCEPTANCE.cjs
