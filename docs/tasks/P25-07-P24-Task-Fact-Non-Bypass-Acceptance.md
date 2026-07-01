# docs/tasks/P25-07-P24-Task-Fact-Non-Bypass-Acceptance.md

Proves P25 cannot bypass a P24 persisted task fact.

Missing, malformed, wrong phase, wrong fact type, not-readback-passed, missing act task id, missing operation plan id, missing parameter schema, or cross-tenant task facts must be blocked before endpoint invocation.

Acceptance:

- node scripts/governance_acceptance/P25_07_P24_TASK_FACT_NON_BYPASS_ACCEPTANCE.cjs
