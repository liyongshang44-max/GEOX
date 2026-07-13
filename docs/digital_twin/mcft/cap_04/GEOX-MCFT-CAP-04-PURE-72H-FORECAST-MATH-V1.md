<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-72H-FORECAST-MATH-V1.md -->

# GEOX MCFT-CAP-04 S3 — Pure 72-Hour Forecast Math V1

## Identity

```text
baseline merged main: 4a8dab632246b05266f1d869f6c9a0a5bcf37e76
branch: agent/mcft-cap-04-s3-pure-72h-forecast-math-v1
delivery slice: MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

## Established boundary

S3 accepts exactly one posterior computation basis, one explicitly pinned CAP-04 Runtime Config and one already-selected 72-point Future Forcing window. It does not select Evidence or mutate State.

The baseline is `NO_NEW_IRRIGATION`. Each hourly step applies the frozen root-zone water-balance rules with 10^-6 mm fixed-point amounts, exact zero mass-balance error, physical storage bounds, available-water fraction and depletion. The 72 points cover `(T,T+72H]` in strict order.

Storage variance begins from the source posterior `computation_basis.storage_variance_mm2_decimal` at 10^-12 mm² scale. Each hour adds rainfall, crop-ET and structural variance with zero covariance and zero baseline-irrigation variance. Physical or interval clipping never reduces latent variance.

The 95% interval uses `NORMAL_95_PERCENT_Z_1_96_V1` with semantics `CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION`. It is not a calibrated probability claim.

Each point receives a semantic hash over its published point and full computation trace. The ordered point hashes determine `trajectory_hash`; the complete result determines `forecast_math_hash`.

## Standard fixture

The 24 logical ticks from `2026-06-03T02:00:00.000Z` through `2026-06-04T01:00:00.000Z` each execute an independent 72-hour pure Forecast trajectory. Their target union contains exactly 95 hours from `2026-06-03T03:00:00.000Z` through `2026-06-07T01:00:00.000Z`.

## Preserved nonclaims

S3 does not implement Scenario equations, canonical Forecast append, A1/A2/B persistence, migration, projection, route, scheduler, calibrated Forecast probability, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
