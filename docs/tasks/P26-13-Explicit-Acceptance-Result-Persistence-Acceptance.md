# docs/tasks/P26-13-Explicit-Acceptance-Result-Persistence-Acceptance.md

Controlled-write acceptance for `acceptance_result_v1` persistence.

The P26 write path is `controlled_fixture_gate`. It writes only `acceptance_result_v1`, explicitly uses direct facts insert for that target scope, and does not call `/api/v1/acceptance/evaluate` or claim production runtime endpoint coverage.

Acceptance:

- node scripts/governance_acceptance/P26_13_EXPLICIT_ACCEPTANCE_RESULT_PERSISTENCE_ACCEPTANCE.cjs
