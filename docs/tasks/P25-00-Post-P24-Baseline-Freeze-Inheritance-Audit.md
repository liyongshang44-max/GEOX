# docs/tasks/P25-00-Post-P24-Baseline-Freeze-Inheritance-Audit.md

Status: active P25 task.

P25-00 verifies that P25 starts only from the completed P24 baseline.

Required anchors:

- baseline_tag = p24_ao_act_task_controlled_persistence_gate_v0
- baseline_commit = 7f76968d9b0037e628e63204b26ef324daffad94
- main must contain the baseline commit.
- P24 task persistence contracts and readback schema must exist.

Acceptance:

- node scripts/governance_acceptance/P25_00_POST_P24_BASELINE_FREEZE_INHERITANCE_AUDIT.cjs
