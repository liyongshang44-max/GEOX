# P35 Controlled Calibration Review Candidate Gate v0

P35 is the calibration-adjacent governance gate after P34.

P35 consumes a P34-governed `forecast_accuracy_review_v1` + `projection_observation_comparison_v1` atomic pair from a local atomic accuracy review ledger or controlled fixture context and creates only `calibration_review_candidate_v1` + `calibration_review_candidate_pointer_v1` governance records.

P35 does not perform calibration computation, parameter update, model update, model version activation, model ranking, projection ranking, recommendation update, problem-state transition, action planning, execution, ROI realization, effect attribution, field-memory promotion, training, or learning.

Baseline:

```text
baseline_tag = p34_controlled_forecast_accuracy_review_backtest_gate_v0_closure
baseline_commit = 119494a3837040741ce86c6bd93916ea36721485
```

Runner:

```text
node scripts/twin_kernel/P35_15_CONTROLLED_CALIBRATION_REVIEW_CANDIDATE_RUNNER_V0.cjs
node scripts/twin_kernel/P35_15_CONTROLLED_CALIBRATION_REVIEW_CANDIDATE_RUNNER_V0.cjs --mode controlled-write
node scripts/twin_kernel/P35_15_CONTROLLED_CALIBRATION_REVIEW_CANDIDATE_RUNNER_V0.cjs --mode controlled-two-step-candidate-chain
```

Acceptance:

```text
node scripts/twin_kernel/P35_ALL_ACCEPTANCE_CHECK.cjs
node scripts/twin_kernel/P35_18_CHECK.cjs
```
