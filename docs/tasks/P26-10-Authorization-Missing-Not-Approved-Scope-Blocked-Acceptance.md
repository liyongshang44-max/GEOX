# docs/tasks/P26-10-Authorization-Missing-Not-Approved-Scope-Blocked-Acceptance.md

Negative acceptance for authorization, scope, role, same-actor override, and tenant boundary failures.

Blocked authorization cases must not create `acceptance_result_v1`, must not pass formal acceptance, and must not invoke the P26 controlled fixture write path.

Acceptance:

- node scripts/governance_acceptance/P26_10_AUTHORIZATION_MISSING_NOT_APPROVED_SCOPE_BLOCKED_ACCEPTANCE.cjs
