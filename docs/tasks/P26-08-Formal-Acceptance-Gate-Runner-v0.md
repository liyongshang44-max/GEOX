# docs/tasks/P26-08-Formal-Acceptance-Gate-Runner-v0.md

Defines the P26 formal acceptance gate runner.

The runner supports dry-run and controlled-write modes. Controlled-write mode uses `controlled_fixture_gate`, writes only `acceptance_result_v1`, and explicitly does not claim production runtime endpoint coverage.

Acceptance:

- node scripts/governance_acceptance/P26_08_FORMAL_ACCEPTANCE_GATE_ACCEPTANCE.cjs
