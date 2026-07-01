# docs/tasks/P25-03-Controlled-Receipt-Intake-Authorization-Contract-v0.md

Defines controlled receipt intake authorization.

Receipt submission requires authorization header, receipt-submit scope, role check, tenant/project/group isolation, and controlled receipt intake authorization. Cross-tenant reads and writes must be non-enumerable.

Acceptance:

- node scripts/governance_acceptance/P25_03_CONTROLLED_RECEIPT_INTAKE_AUTHORIZATION_CONTRACT_ACCEPTANCE.cjs
