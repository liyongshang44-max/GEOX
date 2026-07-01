# docs/tasks/P25-05-Persisted-AO-ACT-Receipt-Fact-Readback-Schema-v0.md

Defines P25 persisted receipt fact readback.

Readback must verify `ao_act_receipt_v0`, task linkage, tenant triple, executor ref, execution time, observed parameters, source refs, and policy refs.

Acceptance:

- node scripts/governance_acceptance/P25_05_PERSISTED_AO_ACT_RECEIPT_FACT_READBACK_SCHEMA_ACCEPTANCE.cjs
