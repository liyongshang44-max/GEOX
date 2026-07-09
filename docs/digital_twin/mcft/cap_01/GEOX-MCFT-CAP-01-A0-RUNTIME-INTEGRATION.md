<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION.md -->
# MCFT-CAP-01 S4 A0 Runtime Integration

```text
delivery_slice_id: MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1
implementation_baseline: 5d17e6ad9944376bbb5a71c9d801aa4472afe592
status: IN_IMPLEMENTATION
primary_owner_work_package_id: MCFT-04
contributing_work_package_ids: MCFT-05, MCFT-08, MCFT-09
```

## Authorized result

S4 connects the already-closed Replay Dataset, Runtime Config, S3A persistence, and S3B posterior mathematics into one controlled `A0_BOOTSTRAP_STATE_COMMIT` transaction.

The first governed tick is:

```text
logical_time: 2026-06-01T01:00:00.000Z
window: (2026-06-01T00:00:00.000Z, 2026-06-01T01:00:00.000Z]
runtime_mode: REPLAY
```

At this tick the frozen Evidence Window includes exactly the on-time soil-moisture observation, rainfall observation, and historical ET0 input. Future weather and future ET0 snapshots issued before the tick but unavailable until `01:05Z` remain excluded as late for this tick. The selected assimilation observation is:

```text
source_record_id: mcft_src_0f8bae003933b54d7d1141e0
observed_at: 2026-06-01T00:50:00.000Z
available_to_runtime_at: 2026-06-01T00:55:00.000Z
canonical VWC fraction: 0.184000
quality: PASS
```

## Canonical A0 append set

The Runtime constructs exactly nine deterministic canonical members:

```text
1. twin_runtime_lineage_v1       INITIAL
2. twin_evidence_window_v1       frozen Replay window
3. twin_state_transition_v1      BOOTSTRAP with embedded weak prior
4. twin_assimilation_update_v1   S3B Gaussian update
5. twin_state_estimate_v1        posterior root-zone State
6. twin_forecast_run_v1          BLOCKED, zero points
7. twin_runtime_tick_v1          COMPLETED_WITH_LIMITATIONS
8. twin_runtime_checkpoint_v1    INITIAL
9. twin_runtime_health_v1        A0_COMMITTED_WITH_BLOCKED_FORECAST
```

The same deterministic `lineage_id` and `revision_id` bind all lineage members. No revision-run or lineage-promotion object is created. `NULL_TO_INITIAL` activation authority is the INITIAL lineage declaration itself.

## Evidence rules

```text
window_rule_id: OPEN_START_CLOSED_END_PT1H_V1
selection_policy_id: LATEST_USABLE_SOIL_OBSERVATION_BEFORE_TICK_V1
future event time: excluded
available_to_runtime_at after tick: excluded as late
quality FAIL: excluded
scope mismatch: excluded
no usable soil observation: hard failure with zero writes
```

The Evidence Window records selected and excluded references, coverage counts, exclusion reasons, and one semantic digest. Later Evidence cannot enter the frozen compute input.

## Posterior and Forecast result

The canonical State embeds the S3B result:

```text
posterior_mean: 0.192595
posterior_variance: 0.002678
posterior_stddev: 0.051746
storage_mean_mm: 57.778512
available_water_fraction: 0.403306
depletion_from_field_capacity_mm: 32.221488
confidence.status: NOT_ESTABLISHED
recommendation_input_eligible: false
action_input_eligible: false
```

The Forecast is intentionally limited:

```text
status: BLOCKED
points: []
scenario_eligible: false
reason_codes:
  - MCFT_06_PROPAGATION_NOT_ESTABLISHED
  - SUCCESSFUL_FORECAST_NOT_AUTHORIZED_FOR_MCFT_CAP_01
  - FUTURE_WEATHER_ASSUMPTION_NOT_AVAILABLE_AT_TICK
  - FUTURE_ET0_ASSUMPTION_NOT_AVAILABLE_AT_TICK
```

A BLOCKED Forecast advances `latest Forecast result` but never advances `latest successful Forecast`.

## Checkpoint and handoff

The terminal tick is `COMPLETED_WITH_LIMITATIONS`. The INITIAL checkpoint advances and records:

```text
previous_checkpoint_ref: null
successful_forecast_ref: null
next_tick_logical_time: 2026-06-01T02:00:00.000Z
handoff_status: READY_FOR_NEXT_TICK_WITHOUT_PROPAGATION_IMPLEMENTATION
```

This is a deterministic handoff marker only. It is not a continuous scheduler, A1/A2 continuation implementation, restart/backfill proof, or propagation capability.

## Persistence order

The service performs:

```text
commit/read immutable Runtime Config
load and hash-verify governed Replay records
freeze Evidence Window
compute posterior and all nine canonical members
compute A0 aggregate key and hashes
lookup complete A0 idempotency record
same key/hash -> existing success without new lease
new key -> acquire fenced lease
commit nine facts, six projections, pointers and idempotency guard atomically
```

The PostgreSQL repository remains the only write authority. Failure at any append, projection, idempotency, or pre-commit stage yields zero A0 facts, projections, and pointer changes.

## Nonclaims

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_AO_ACT
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_CAP_01_CLOSURE
```
