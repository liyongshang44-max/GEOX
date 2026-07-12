<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-SCENARIO-CONTRACTS-CONFIG-V1.md -->
# MCFT-CAP-04 S1 — Forecast/Scenario Contracts and Runtime Config V1

## Authority

```text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
delivery slice: MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
baseline merged main: 870bcc621e8d0495ae5acbedd534068a18d402b9
runtime mode: REPLAY
target: Level A — Deterministic Replay Twin
```

This slice establishes contracts and immutable Runtime Config authority only. It does not select Future Forcing, execute Forecast or Scenario equations, persist A1/A2/B record sets, add projections, expose routes, run a scheduler, recommend an action, make a decision, or dispatch AO-ACT.

## Record-set contracts

```text
A1 contract: MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
A1 operation variant: A1_COMPLETED
A1 member count: 8

A2 contract: MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
A2 operation variant: A2_BLOCKED_FORECAST
A2 member count: 8

B contract: MCFT_CAP_04_THREE_SCENARIO_SET_V1
B transaction variant: B_SCENARIO_COMMIT
B canonical object count: 1
```

A1 and A2 share the terminal-tick uniqueness key:

```text
tenant_id + project_id + group_id + field_id + season_id + zone_id
+ lineage_id + revision_id + logical_time
```

Their operation idempotency keys additionally include `operation_variant`. This permits deterministic retry of the selected operation while forbidding two terminal ticks for the same lineage/revision/logical time.

The canonical Tick is the recovery root and directly carries exactly six object refs:

```text
evidence_window_ref
state_transition_ref
assimilation_update_ref
posterior_state_ref
forecast_result_ref
checkpoint_ref
```

Health remains discoverable only through unique reverse lookup:

```text
health.payload.tick_ref == tick.object_id
```

`health_ref` on Tick is forbidden.

## Forecast point contract

A completed Forecast has exactly 72 ordered points. For issue time `T` and horizon `h`:

```text
h ∈ [1,72]
target_time = T + h hours
interval = (target_time - PT1H, target_time]
```

Horizon zero, gaps, duplicates, overlap, order drift, 71/73 points and non-hour-aligned targets are invalid.

The baseline assumption is exactly `NO_NEW_IRRIGATION`. It is an epistemic assumption, not a recommendation, policy evaluation, decision or action.

A blocked Forecast has zero points, at least one reason code and `scenario_eligible=false`.

## Scenario contract

The canonical option order is exactly:

```text
NO_ACTION
IRRIGATE_NOW_15MM
IRRIGATE_NOW_25MM
```

All options are `ASSUMED` and `NOT_EXECUTED`. The NO_ACTION trajectory is exact canonical deep-copy equivalent to `source Forecast.points`. Bare `assumption_ref` and fake execution evidence are forbidden.

Scenario canonical uniqueness is:

```text
source_forecast_ref + source_forecast_hash + lineage_id + revision_id
```

Operation idempotency additionally includes Scenario policy and Runtime Config ref/hash. A second operation under the same canonical uniqueness with different policy/config/hash is a `SCENARIO_SET_CANONICAL_CONFLICT`, not another canonical Scenario Set.

## Explicit validator dispatch

The dispatch authority recognizes exactly:

```text
MCFT_CAP_02_CONTINUATION_V1
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
MCFT_CAP_04_THREE_SCENARIO_SET_V1
```

Payload-shape guessing, Forecast-status inference as dispatch, and silent fallback to an older validator are forbidden.

## Immutable Runtime Config chain

The config purpose is:

```text
FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1
```

The slice compiles exactly 24 immutable `twin_runtime_config_v1` objects:

```text
C1.parent = CAP-03 final State-bound Runtime Config ref/hash
Cn.parent = C(n-1).ref/hash for n=2..24
```

Every object is committed through the existing `D_MODEL_GOVERNANCE_STEP_COMMIT` persistence family and canonically read back. Latest/active pointer substitution, self-parenting, chain gaps, static reuse and in-place mutation are forbidden.

Frozen authority includes:

```text
Forecast horizon: 72 hours
Forecast step: 1 hour
forcing pair policy: JOINT_MATCHING_FORCING_CYCLE_V1
forcing fallback: NO_CROSS_SNAPSHOT_STITCHING_V1
interval: NORMAL_95_PERCENT_Z_1_96_V1
rounding: DECIMAL_HALF_AWAY_FROM_ZERO_V1
Scenario policy: THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1
application efficiency: 1.000000 CONTROLLED_SYNTHETIC NOT_FIELD_CALIBRATED
stress threshold: 0.350000 STRICT_LESS_THAN CONTROLLED_SYNTHETIC NOT_FIELD_CALIBRATED
```

The two Scenario policies are embedded authority. Dangling `scenario_application_efficiency_ref/hash` and `stress_threshold_ref/hash` are forbidden.

## Hash boundary

The emitted Tick carries the aggregate record-set hash. To avoid a recursive fixed point, the Tick member determinism hash is computed from the Tick envelope with `payload.aggregate_determinism_hash` omitted. The emitted payload retains the aggregate field and validation applies the same explicit nonrecursive basis.

## Preserved nonclaims

```text
NO_FUTURE_FORCING_WINDOW
NO_SUCCESSFUL_FORECAST_CREATED_BY_S1
NO_SCENARIO_CREATED_BY_S1
NO_A1_A2_B_PERSISTENCE
NO_FORECAST_RESIDUAL
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_MODEL_ACTIVATION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
