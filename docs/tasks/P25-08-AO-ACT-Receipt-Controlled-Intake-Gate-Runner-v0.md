# docs/tasks/P25-08-AO-ACT-Receipt-Controlled-Intake-Gate-Runner-v0.md

Defines the P25 runner.

The runner supports dry-run and controlled-write modes. Controlled-write mode requires explicit env, prewrite existing receipt check, declared precondition seed scope, endpoint invocation, and DB readback for receipt, plan transition, and terminal plan update.

Acceptance:

- node scripts/governance_acceptance/P25_08_AO_ACT_RECEIPT_CONTROLLED_INTAKE_GATE_ACCEPTANCE.cjs
