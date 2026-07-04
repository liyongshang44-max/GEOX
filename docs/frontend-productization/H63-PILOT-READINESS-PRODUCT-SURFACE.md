# H63 Pilot Readiness Product Surface

Route: `/operator/pilot`

Source: `field_pilot_readiness_product_v1`

Mode: `controlled_pilot_readiness_review`

H63 productizes P53/P54 planning and readiness metadata inside the Operator Runtime Console.

It does not start a field pilot.
It does not deploy real devices.
It does not bring a production gateway online.
It does not activate live runtime monitoring.
It does not create AO-ACT tasks.
It does not dispatch.
It does not create execution records.
It does not compute ROI.
It does not write Field Memory.
It does not freeze Full Runtime v1.

Required product panels:

- P53 Pilot Planning Gate
- P54 Readiness Review Gate
- Candidate Site Scope
- Evidence Protocol
- Device / Gateway Readiness Plan
- Human Role Matrix
- Safety / Stop Rules and Rollback Plan
- Go / No-Go Gate
- Readiness Dimensions
- Capability Matrix
- Traceability
- Boundary / Nonclaims
- Next Allowed Gate

Acceptance:

node scripts/frontend_acceptance/ACCEPTANCE_H63_OPERATOR_PILOT_V1.cjs
pnpm run typecheck:web
pnpm run build:web