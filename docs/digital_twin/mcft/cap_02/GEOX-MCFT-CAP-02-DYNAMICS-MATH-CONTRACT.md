# GEOX MCFT-CAP-02 — Pure Hourly Dynamics Math Contract

## Identity

```text
capability_line_id: MCFT-CAP-02
delivery_slice_id: MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1
primary_owner_work_package_id: MCFT-06
runtime_mode: REPLAY
model_id: ROOT_ZONE_HOURLY_WATER_BALANCE_V1
model_version: 1
step_duration: PT1H
truth_class: CONTROLLED_SYNTHETIC
calibration_status: NOT_FIELD_CALIBRATED
```

This slice is a pure-domain numerical implementation. It does not select Evidence, persist continuation objects, advance checkpoints, or execute a Runtime tick.

## Governance preflight debt

`MCFT-CAP-02.GOV-DEBT-001` is remediated before the first Dynamics source commit.

The debt was caused by the contracts/config Gate retaining a premerge-only message when executed on merged `main`. The remediation is frozen in:

```text
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-GOVERNANCE-DEBT-REGISTER.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs --postmerge
```

The contracts/config slice is recorded as merged at:

```text
2be7c985210d1f34fa5249e1fae68932e801facc
```

with merged-main Gate evidence:

```text
63 PASS, 0 FAIL
```

## Numerical authority

All water amount calculations use decimal strings represented internally as `BigInt` at scale `10^-6 mm`.

All variance calculations use `BigInt` at scale `10^-12 mm²`.

```text
rounding_rule: DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

JavaScript binary floating point, `toFixed()` and locale-sensitive formatting are not computational authorities.

## Governed control volume

```text
root_zone_depth_mm: 300.000000
wilting_point_storage_mm: 36.000000
field_capacity_storage_mm: 90.000000
saturation_storage_mm: 135.000000
```

Crop-stage `crop_root_depth_mm` and `effective_model_root_depth_mm` are not consumed.

## Hourly water balance

```text
surface_runoff_mm
= gross_rainfall_mm × runoff_fraction

effective_rainfall_mm
= gross_rainfall_mm - surface_runoff_mm

event_effective_irrigation_mm
= executed_amount_mm × coverage_fraction

effective_irrigation_mm
= Σ event_effective_irrigation_mm

requested_crop_et_mm
= historical_et0_mm × kc

water_before_et_mm
= previous_storage_mm
+ effective_rainfall_mm
+ effective_irrigation_mm

actual_crop_et_mm
= min(requested_crop_et_mm, water_before_et_mm)

unmet_crop_et_mm
= requested_crop_et_mm - actual_crop_et_mm

storage_before_drainage_mm
= water_before_et_mm - actual_crop_et_mm

drainage_mm
= max(0, storage_before_drainage_mm - field_capacity_storage_mm)
× drainage_coefficient_per_hour

storage_after_drainage_mm
= storage_before_drainage_mm - drainage_mm

saturation_overflow_mm
= max(0, storage_after_drainage_mm - saturation_storage_mm)

next_storage_mm
= storage_after_drainage_mm - saturation_overflow_mm
```

The output must satisfy:

```text
0.000000 <= next_storage_mm <= 135.000000
```

## Executed irrigation contract

Only actual executed amounts may enter Dynamics.

Forbidden fields:

```text
approved_amount_mm
planned_amount_mm
dispatched_amount_mm
```

Eligible events are ordered by:

```text
executed_at ascending
ingested_at ascending
source_record_id ascending
```

Duplicate behavior:

```text
same semantic identity + same canonical payload
→ deterministic deduplication

same semantic identity + different canonical payload
→ CONFLICTING_DUPLICATE_EVIDENCE
```

Spatial overlap correction is not established.

## Mass-balance invariant

```text
previous_storage
+ gross_rainfall
+ effective_irrigation
=
next_storage
+ surface_runoff
+ actual_crop_et
+ drainage
+ saturation_overflow
```

The internal fixed-point error must be exactly zero and the published value must be:

```text
0.000000
```

The complete trace is hashed only after construction. Recursive self-hash fields are forbidden.

## Additive process uncertainty

The frozen uncertainty policy identity is:

```text
policy_id: CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1
policy_version: 1
covariance_policy: ZERO_COVARIANCE_CONTROLLED_ASSUMPTION_V1
physical_clipping_reduces_latent_variance: false
```

```text
rainfall_variance_mm2
= (gross_rainfall_mm × 0.100000)²

crop_et_variance_mm2
= (requested_crop_et_mm × 0.150000)²

irrigation_variance_mm2
= (effective_irrigation_mm × 0.100000)²

structural_variance_mm2
= 0.500000²
= 0.250000000000

next_storage_variance_mm2
= previous_storage_variance_mm2
+ rainfall_variance_mm2
+ crop_et_variance_mm2
+ irrigation_variance_mm2
+ structural_variance_mm2
```

The first continuation tick may derive storage variance once:

```text
source_vwc_variance × 300²
```

Subsequent ticks must carry the persisted storage variance and must not rederive it from published VWC variance.

## Published State derivations

```text
root_zone_vwc_fraction.mean
= next_storage_mm / 300.000000

root_zone_vwc_fraction.variance
= next_storage_variance_mm2 / 300²

raw_available_water_fraction
= (next_storage_mm - 36.000000) / (90.000000 - 36.000000)

available_water_fraction
= clamp(raw_available_water_fraction, 0, 1)

depletion_from_field_capacity_mm
= max(0, 90.000000 - next_storage_mm)
```

The 95% Gaussian approximation interval may be clipped to `[0, 0.450000]`, but clipping does not reduce latent variance.

## Preserved nonclaims

```text
NO_CONTINUATION_EVIDENCE_WINDOW_SELECTION_IMPLEMENTED
NO_CONTINUATION_STATE_PERSISTED
NO_A2_CONTINUATION_TICK_COMMITTED
NO_OBSERVATION_UPDATE_APPLIED
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_RESTART_RESUME_PROOF
NO_BOUNDED_BACKFILL_PROOF
NO_MCFT_CAP_02_COMPLETE_CLAIM
```
