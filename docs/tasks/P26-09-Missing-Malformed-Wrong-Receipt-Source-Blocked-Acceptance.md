# docs/tasks/P26-09-Missing-Malformed-Wrong-Receipt-Source-Blocked-Acceptance.md

Negative acceptance for missing, malformed, or wrong receipt source inputs.

Blocked inputs must not create `acceptance_result_v1`, must not pass formal acceptance, and must not invoke the P26 controlled fixture write path.

Acceptance:

- node scripts/governance_acceptance/P26_09_MISSING_MALFORMED_WRONG_RECEIPT_SOURCE_BLOCKED_ACCEPTANCE.cjs
