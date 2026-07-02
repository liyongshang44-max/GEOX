# P36 Controlled Offline Calibration Trial Plan Gate v0

P36 creates a bounded, non-executable offline calibration trial plan policy envelope from a P35 candidate pair. It creates only offline_calibration_trial_plan_v1 and offline_calibration_trial_context_pointer_v1 in a local atomic ledger. It does not execute trials, materialize datasets, create feature matrices, generate hyperparameter spaces, create parameter deltas, train models, update models, activate model versions, rank models or projections, update recommendations, trigger actions, realize ROI, attribute effects, promote Field Memory, or create learning signals.

Baseline: p35_controlled_calibration_review_candidate_gate_v0_closure at 200b05e7d78b30abe66c4085e875f753803ec534.

Acceptance:

```text
node scripts/twin_kernel/P36_ALL_ACCEPTANCE_CHECK.cjs
node scripts/twin_kernel/P36_23_CHECK.cjs
```
