# P37 Offline Calibration Trial Execution Gate v0

P37 consumes a P36-governed offline calibration trial plan pair and creates local append-only execution evidence records for one bounded offline sandbox run.

P37 allows only `offline_calibration_trial_run_v1`, `offline_calibration_trial_run_context_v1`, and `offline_calibration_trial_log_ref_v1`.

P37 does not create calibration results, parameter deltas, estimator config patches, model candidates, shadow models, model updates, model activations, recommendations, actions, ROI, effect attribution, Field Memory, or learning records.

Baseline: `p36_controlled_offline_calibration_trial_plan_gate_v0_closure` at `46ef5c3a8bac0f6b2c3d36933126627c3eae44e8`.

Acceptance:

```text
node scripts/twin_kernel/P37_ALL_ACCEPTANCE_CHECK.cjs
node scripts/twin_kernel/P37_22_CHECK.cjs
```
