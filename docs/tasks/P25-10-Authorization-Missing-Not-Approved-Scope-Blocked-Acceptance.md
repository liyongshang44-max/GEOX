# docs/tasks/P25-10-Authorization-Missing-Not-Approved-Scope-Blocked-Acceptance.md

Negative acceptance for authorization, role, scope, and tenant boundary failures.

Blocked authorization cases must not invoke the receipt endpoint and must not create receipt facts, plan transitions, or terminal plan updates.

Acceptance:

- node scripts/governance_acceptance/P25_10_AUTHORIZATION_MISSING_NOT_APPROVED_SCOPE_BLOCKED_ACCEPTANCE.cjs
