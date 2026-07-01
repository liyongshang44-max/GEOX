# docs/tasks/P25-09-Missing-Malformed-Wrong-Task-Source-Blocked-Acceptance.md

Negative acceptance for missing, malformed, or wrong task source inputs.

Blocked inputs must not invoke the receipt endpoint and must not create receipt facts, plan transitions, or terminal plan updates.

Acceptance:

- node scripts/governance_acceptance/P25_09_MISSING_MALFORMED_WRONG_TASK_SOURCE_BLOCKED_ACCEPTANCE.cjs
