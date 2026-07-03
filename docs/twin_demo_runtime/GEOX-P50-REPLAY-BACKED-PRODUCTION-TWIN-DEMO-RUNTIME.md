<!-- docs/twin_demo_runtime/GEOX-P50-REPLAY-BACKED-PRODUCTION-TWIN-DEMO-RUNTIME.md -->

# P50 Replay-backed Production Twin Demo Runtime

## 0. Position

P50 is the first post-P49 runtime demonstration gate. It derives from the P49 closure tag, not from the earlier P49 final tag.

```text
baseline_tag = p49_twin_runtime_v1_pilot_freeze_evidence_package_v0_closure
baseline_commit = ea00d8b3a70f6dd1e7e61f7415c2444fd6b76a23
```

P50 demonstrates runtime behavior under historical replay and time-shifted demo constraints. It does not revise the P49 result.

```text
p49_result_remains = PASS_WITH_LIMITATIONS
runtime_v1_freeze_allowed = false
```

## 1. Scope

P50 implements a deterministic replay-backed demo runtime. The demo runtime loads a pinned historical replay manifest, partitions evidence by `demo_as_of_ts`, runs a demo runtime cycle using only pre-as-of evidence, generates a demo-scoped state estimate, generates a forecast without future observation access, releases later evidence through a time gate, computes residuals from released evidence, records a demo calibration review, records active model/config consumption, and generates a next forecast that explicitly references the consumed active model/config.

This is a demo namespace. It is not a real device gateway, live sensor integration, field pilot, autonomous operation, machine dispatch, AO-ACT persistence, ROI, effect attribution, Field Memory, learning loop, production rollout, or full Runtime v1 freeze.

## 2. Core invariants

```text
time_shifted_live_demo = true
source_truth_mode = historical_replay
demo_runtime_is_not_production_runtime = true
demo_runtime_is_not_live_device_gateway = true
demo_runtime_is_not_field_pilot = true
runtime_cycle_must_not_read_evidence_after_demo_as_of_ts = true
forecast_must_not_access_future_observation = true
later_evidence_release_must_be_time_gated = true
residual_must_use_only_released_later_evidence = true
calibration_review_must_use_only_forecast_and_released_later_evidence = true
next_forecast_active_model_consumption_must_be_explicitly_recorded = true
```

## 3. Demo time model

The demo clock is explicit and pinned in `fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json`. The runner must not use wall-clock `now` or implicit latest lookup.

Required ordering:

```text
replay_dataset_start_ts <= demo_as_of_ts
forecast_issued_at >= demo_as_of_ts
forecast_horizon_start_ts >= forecast_issued_at
forecast_horizon_end_ts > forecast_horizon_start_ts
later_evidence_release_start_ts >= forecast_horizon_start_ts
later_evidence_release_end_ts <= forecast_horizon_end_ts
residual_computed_at >= later_evidence_release_end_ts
calibration_reviewed_at >= residual_computed_at
active_model_consumed_at >= calibration_reviewed_at
next_forecast_issued_at >= active_model_consumed_at
```

## 4. Demo outputs

P50 may produce only demo-scoped record envelopes in memory and, in controlled-write mode, in `acceptance-output/`:

```text
replay_demo_input_manifest_v1
replay_demo_evidence_partition_v1
replay_demo_runtime_cycle_v1
replay_demo_state_estimate_v1
replay_demo_forecast_run_v1
replay_demo_prediction_v1
replay_demo_later_evidence_release_v1
replay_demo_residual_v1
replay_demo_calibration_review_v1
replay_demo_model_candidate_v1
replay_demo_shadow_evaluation_v1
replay_demo_active_model_consumption_v1
replay_demo_next_forecast_run_v1
replay_demo_traceability_packet_v1
replay_demo_capability_matrix_v1
```

Controlled-write mode may write only:

```text
acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_LEDGER.jsonl
acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_REPORT.json
```

## 5. P49 relation

P50 improves the evidence posture for future full-freeze evaluation by demonstrating demo-scoped equivalents for the P49 Q2 and Q10 limitations. It does not mutate P49 matrix, P49 evidence packet, P49 closure metadata, or P49 freeze result.

Allowed P50 claims:

```text
demo_scoped_state_estimate_generated = true
specific_demo_next_forecast_consumed_active_model = true
```

Forbidden P50 claims:

```text
production_state_estimate_v1_engine_frozen = false
production_next_forecast_consumed_active_model_frozen = false
full_runtime_v1_freeze_allowed = false
```

## 6. Local acceptance

```text
node scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_ACCEPTANCE.cjs
```

Expected result:

```json
{
  "ok": true,
  "acceptance": "P50_REPLAY_BACKED_DEMO_RUNTIME_ACCEPTANCE",
  "phase": "P50",
  "failed_assertion_count": 0
}
```
