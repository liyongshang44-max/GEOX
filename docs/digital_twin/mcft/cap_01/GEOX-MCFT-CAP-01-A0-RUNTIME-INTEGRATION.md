<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION.md -->
# MCFT-CAP-01 S4 A0 Runtime Integration

```text
delivery_slice_id: MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1
historical_implementation_candidate_head: 62a3906812ef048ca1e35ced192556b4f843c5b7
historical_merge_commit: 4a0fd03beb05298028101a4999c67a5e053dadb8
current_status: REMEDIATION_REQUIRED
remediation_slice_id: MCFT-CAP-01.CLOSURE-REMEDIATION-V1
```

## Established result retained

S4 connects the Replay Dataset, Runtime Config, A0 persistence and bootstrap posterior mathematics into one controlled `A0_BOOTSTRAP_STATE_COMMIT` transaction.

```text
logical_time: 2026-06-01T01:00:00.000Z
window: (2026-06-01T00:00:00.000Z, 2026-06-01T01:00:00.000Z]
runtime_mode: REPLAY
selected soil observation: mcft_src_0f8bae003933b54d7d1141e0
canonical VWC fraction: 0.184000
```

The Runtime atomically commits exactly nine deterministic canonical members:

```text
1. twin_runtime_lineage_v1
2. twin_evidence_window_v1
3. twin_state_transition_v1
4. twin_assimilation_update_v1
5. twin_state_estimate_v1
6. twin_forecast_run_v1
7. twin_runtime_tick_v1
8. twin_runtime_checkpoint_v1
9. twin_runtime_health_v1
```

Retained State result:

```text
posterior_mean: 0.192595
posterior_variance: 0.002678
posterior_stddev: 0.051746
storage_mean_mm: 57.778512
available_water_fraction: 0.403306
depletion_from_field_capacity_mm: 32.221488
confidence.status: NOT_ESTABLISHED
```

The Forecast remains:

```text
status: BLOCKED
points: []
scenario_eligible: false
```

## Corrected checkpoint claim

The INITIAL checkpoint records:

```text
previous_checkpoint_ref: null
last_posterior_state_ref: <A0 State object_id>
next_tick_logical_time: 2026-06-01T02:00:00.000Z
```

The historical service returned that time by reading the checkpoint inside the current A0 record set. It did not reconstruct the next tick from persisted active lineage, latest checkpoint, latest State, Runtime Config and Reality Binding.

Therefore the accurate retained claim is:

```text
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
```

The following claim is withdrawn until remediation passes:

```text
NEXT_TICK_HANDOFF_ESTABLISHED
```

## Confirmed S4 remediation requirements

```text
persisted prepareNextTickInput service
PostgreSQL consistent read of active lineage/checkpoint/State/Runtime Config/Reality Binding
conflicting duplicate soil observation rejection
observed_at desc / ingested_at desc / source_record_id asc selection
complete Evidence Window ingestion/freshness/unit/conversion/limitations trace
separate window inclusion and estimator-consumption semantics
manual operator-invokable A0 runner
```

The remediated Evidence Window must identify:

```text
soil:
CONSUMED_BY_BOOTSTRAP_ESTIMATOR

rainfall:
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR

historical ET0:
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR
```

Conflicting records must produce zero Runtime Config canonical fact delta, zero A0 fact delta and zero projection delta.

## Historical evidence retained

```text
S4 A0 Runtime static Gate: 20 PASS, 0 FAIL
S4 A0 Runtime PostgreSQL Gate: 12 PASS, 0 FAIL
PostgreSQL fault stages: 17 rollback, 0 partial writes
canonical facts committed: 9
projections committed: 6
latest successful Forecast rows: 0
same-input replay: existing success before lease
projection rebuild: 6 equivalent projections
CI #4456: SUCCESS
```

These results remain valid for the behavior tested. They did not test persisted next-tick reconstruction, conflicting duplicates, complete consumption trace or the manual runner.

## Claims retained

```text
A0_RUNTIME_EXECUTION_ESTABLISHED
BOOTSTRAP_STATE_COMMITTED
ACTIVE_INITIAL_LINEAGE_ESTABLISHED
INITIAL_CHECKPOINT_ESTABLISHED
BLOCKED_FORECAST_RESULT_ESTABLISHED
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
```

## Nonclaims during remediation

```text
NO_PERSISTED_NEXT_TICK_HANDOFF
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_CAP_01_CLOSURE
```
