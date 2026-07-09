<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-BOOTSTRAP-MATH.md -->
# MCFT-CAP-01 S3B Bootstrap State Mathematics

```text
delivery_slice_id: MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
implementation_baseline: 4ddd2bbf4d5d421f875e3ab5b1bfd76749f2ca3a
status: IN_IMPLEMENTATION
primary_owner_work_package_ids: MCFT-07, MCFT-08
claim: NO_A0_RUNTIME_EXECUTION
```

S3B establishes a pure deterministic computation from one governed root-zone-representative point observation and a configured weak prior to a posterior root-zone water DTO. It does not select Evidence, construct an Evidence Window, execute A0, write canonical facts, update projections, or establish an Initial lineage or checkpoint.

## Frozen equations

```text
prior_mean = (wilting_point + field_capacity) / 2
prior_stddev = (field_capacity - wilting_point) / 2
prior_variance = prior_stddev^2

sensor_variance = sensor_stddev^2
representativeness_variance = representativeness_stddev^2
base_observation_variance = sensor_variance + representativeness_variance
effective_observation_variance = base_observation_variance / quality_weight

gain = prior_variance / (H^2 * prior_variance + observation_variance)
posterior_mean = prior_mean + gain * (observation - H * prior_mean)
posterior_variance = (1 - gain * H) * prior_variance
```

All intermediate calculations retain full JavaScript numeric precision. Only emitted semantic fields use `DECIMAL_HALF_AWAY_FROM_ZERO_V1` at six decimal places.

## Standard case

```text
observation: 0.184000
prior_mean: 0.210000
prior_variance: 0.008100
observation_variance: 0.004000
innovation: -0.026000
assimilation_gain: 0.669421
posterior_mean: 0.192595
posterior_variance: 0.002678
posterior_stddev: 0.051746
storage_mean_mm: 57.778512
available_water_fraction: 0.403306
depletion_from_field_capacity_mm: 32.221488
```

## Frozen physical and epistemic boundary

```text
physical_bound_version: ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1
gaussian_interval_rule: NORMAL_95_Z_1_96_V1
uncertainty_interval_clip_rule: CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1
direct_state_equivalence: false
confidence.status: NOT_ESTABLISHED
recommendation_input_eligible: false
action_input_eligible: false
```

The legacy `root_zone_soil_water_state_builder_v1` is not reused because it represents a different historical projection model and emits numeric confidence. S3B has an independent contract, validator, fixture, and purity Gate.

## Nonclaims

```text
NO_EVIDENCE_WINDOW
NO_REPLAY_SELECTION
NO_A0_RUNTIME_EXECUTION
NO_CANONICAL_WRITE
NO_POSTGRES
NO_ACTIVE_INITIAL_LINEAGE
NO_INITIAL_CHECKPOINT
NO_FORECAST_CONSTRUCTION
NO_PROPAGATION
NO_CONTINUOUS_RUNTIME
NO_MCFT_CAP_01_CLOSURE
```
