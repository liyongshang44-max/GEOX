# docs/tasks/P26-07-P25-Receipt-Non-Bypass-Acceptance.md

Proves P26 cannot bypass the P25 receipt plus bounded plan transition readback.

Missing receipt, missing transition, missing terminal plan, wrong source phase, malformed readback, missing P25 policy refs, and terminal-deduped-without-new-transition cases must be blocked before acceptance creation.

Acceptance:

- node scripts/governance_acceptance/P26_07_P25_RECEIPT_NON_BYPASS_ACCEPTANCE.cjs
