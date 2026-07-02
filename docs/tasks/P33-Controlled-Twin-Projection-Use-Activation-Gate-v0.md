# P33 Controlled Twin Projection Use Activation Gate v0

## Phase

P33 creates a policy-controlled projection-use activation gate for an already existing P32 governed `forecast_run_v1` + `twin_state_projection_v1` atomic pair.

P33 does not activate a model, validate forecast accuracy, calibrate predictions, create recommendations, trigger actions, update problem states, realize ROI, promote field memory, or create learning signals.

## Baseline

```text
baseline_tag = p32_controlled_twin_forecast_projection_runtime_v0_governance_correction_v2
baseline_commit = 938680917f1f0c5d9a1978df464971f524fd7add
```

The stale P32 closure tag is not a valid P33 baseline.

## Storage boundary

P33 may consume a P32 projection pair from:

```text
p32_local_atomic_pair_ledger_ref
p32_controlled_fixture_pair_ref
```

P33 v0 writes only a local activation pointer ledger. It does not claim facts-table persistence, database persistence, server endpoints, migrations, or frontend surface.

## Allowed created objects

```text
projection_use_activation_v1
active_projection_pointer_v1
```

They must be created as an atomic pair.

## Active semantics

Active only means:

```text
eligible_for_read_model_use = true
eligible_as_projection_context = true
eligible_for_operator_workbench_display = true
```

Active does not mean correct, best, preferred, recommended, actionable, calibrated, or model-validating.

## Runner

```text
node scripts/twin_kernel/P33_15_CONTROLLED_PROJECTION_USE_ACTIVATION_RUNNER_V0.cjs
node scripts/twin_kernel/P33_15_CONTROLLED_PROJECTION_USE_ACTIVATION_RUNNER_V0.cjs --mode controlled-write
node scripts/twin_kernel/P33_15_CONTROLLED_PROJECTION_USE_ACTIVATION_RUNNER_V0.cjs --mode controlled-two-step-pointer-chain
```

## Acceptance

```text
node scripts/twin_kernel/P33_ALL_ACCEPTANCE_CHECK.cjs
node scripts/twin_kernel/P33_18_CHECK.cjs
```
