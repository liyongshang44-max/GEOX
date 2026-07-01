# docs/tasks/P25-02-P24-Persisted-Task-Fact-Input-Boundary-v0.md

Defines the P24 persisted `ao_act_task_v0` input boundary for P25.

P25 must consume a P24 persisted task fact readback. It must not consume a P23 task creation packet, an unpersisted task envelope, dispatch payload, receipt payload, execution evidence, outcome review, Field Memory, or model update as source input.

Acceptance:

- node scripts/governance_acceptance/P25_02_P24_PERSISTED_TASK_FACT_INPUT_BOUNDARY_ACCEPTANCE.cjs
