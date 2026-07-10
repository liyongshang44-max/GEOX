<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION.md -->
# MCFT-CAP-03 S2 — Observation Selection and Assimilation Math V1

## Delivery identity

```text
MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1
```

Baseline main:

```text
ed816b9f2f2061183918e0dfb484b949859ff3aa
```

Branch:

```text
mcft-cap-03-observation-selection-assimilation-math-v1
```

This slice is pure application and domain logic. It does not persist an A2 record set, execute a Runtime tick, advance a checkpoint, create a migration, expose a route, schedule work, or alter the web application.

## Predecessor authority

S1 is effective on merged main:

```text
S1 merge commit = bbd4c916923b208d78dcf27f6e26ed255abe1262
S1 postmerge status commit = ed816b9f2f2061183918e0dfb484b949859ff3aa
S1 merged-main Gate = 116 PASS, 0 FAIL
```

CAP-02 historical contracts and `ContinuationEvidenceWindowV1` remain immutable.

## Independent Evidence Window contract

S2 introduces:

```text
MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1
AssimilatedContinuationEvidenceWindowV1
buildAssimilatedContinuationEvidenceWindowV1
finalizeAssimilatedContinuationEvidenceWindowV1
```

The wrapper invokes the immutable CAP-02 Evidence Window builder for rainfall, historical ET0, irrigation execution, crop-stage context and historical classifications. Observation selection is added separately; the CAP-02 payload and semantic digest are not reinterpreted.

The CAP-03 trace separates:

```text
dynamics_consumed_evidence_refs
assimilation_evaluated_evidence_refs
assimilation_applied_evidence_refs
context_only_evidence_refs
rejected_evidence_refs
consumed_evidence_refs
```

Compatibility definition:

```text
consumed_evidence_refs
=
lexicographic unique union(
  dynamics_consumed_evidence_refs,
  assimilation_applied_evidence_refs
)
```

## Observation selector

Selector identity:

```text
LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1
```

Authorized v1 input:

```text
record_type = soil_moisture_observation_v1
epistemic_class = OBSERVED
binding_id = soil_obs_c8_20cm_v1
quantity_kind = VOLUMETRIC_WATER_CONTENT
canonical unit = fraction
0 <= canonical value <= saturation_fraction
```

Time eligibility:

```text
observed_at > T - PT1H
observed_at <= T
available_to_runtime_at <= T
ingested_at <= T
T - observed_at <= PT15M
```

The exact `T - PT15M` boundary is eligible. Older observations are `REJECTED_TIME_STALE`.

Malformed canonical Evidence fails closed with `MALFORMED_CANONICAL_OBSERVATION`; it is not converted into a legal `NOT_APPLIED` update.

## Semantic identity and duplicate resolution

Observation semantic identity is canonical-hashed from:

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
binding_id
quantity_kind
observed_at
origin_source_kind
origin_source_id
source_version
```

`source_record_id` is excluded from semantic identity.

`observation_semantic_content_hash` is canonical-hashed from:

```text
canonical_payload
quality_status
source_unit
canonical_unit
conversion_rule
epistemic_class
```

Same semantic identity plus the same content hash produces `IDENTICAL_DUPLICATE_SUPPRESSED`. Different content hashes produce `CONFLICTING_DUPLICATE_EVIDENCE` and fail the whole selector.

Identical duplicate winner:

```text
ingested_at DESC
source_record_id ASC
```

Usable candidate order:

```text
observed_at DESC
ingested_at DESC
source_record_id ASC
```

Only the latest usable candidate is selected. Older usable candidates remain `NOT_SELECTED_OLDER_USABLE`. No averaging or multi-sensor fusion is performed.

## Candidate assessment priority

Primary assessment order:

```text
REJECTED_SCOPE
REJECTED_TIME_FUTURE
REJECTED_TIME_LATE
REJECTED_TIME_STALE
REJECTED_UNAUTHORIZED_BINDING
REJECTED_RECORD_TYPE
REJECTED_QUANTITY
REJECTED_CANONICAL_UNIT
REJECTED_PHYSICAL_BOUNDS
REJECTED_QUALITY_FAIL
```

Other matched conditions remain in `reason_codes`.

## Pure continuation assimilation composer

S2 introduces:

```text
assimilated_continuation_posterior_v1.ts
composeAssimilatedContinuationPosteriorV1
```

The composer receives a propagated prior and an already-selected observation. It does not select Evidence or perform persistence.

Frozen sequence:

```text
propagated prior
observation prediction
innovation variance
direct squared innovation Gate
Gaussian candidate
physical clipping
published posterior
```

Observation operator and variance:

```text
H = 1
direct_state_equivalence = false
R_base = sensor_stddev^2 + representativeness_stddev^2
R_effective = R_base / quality_weight
S = H^2 P_prior + R_effective
innovation = observation - H x_prior
innovation == residual
residual_kind = STATE_OBSERVATION_INNOVATION
```

Threshold authority:

```text
INNOVATION_SQUARED_LE_16_TIMES_VARIANCE
innovation^2 <= 16 * S
```

The reported `squared_normalized_innovation` is an audit trace; the decision does not depend on first dividing or taking a square root.

Legal results:

```text
APPLIED / ACCEPTED
APPLIED / DOWNWEIGHTED
NOT_APPLIED / REJECTED_OUTLIER
NOT_APPLIED / NO_USABLE_OBSERVATION
```

For an outlier, predicted/actual observation, innovation, variance, normalized trace and candidate gain remain available. No candidate posterior is published, no applied gain exists, and the propagated prior is published unchanged.

For no usable observation, observation and innovation fields are null, all observation reference lists are empty, and State correction is zero.

## Gaussian update and clipping

The composer reuses the established scalar Gaussian implementation:

```text
SCALAR_GAUSSIAN_ASSIMILATION_V1
```

It does not reuse the bootstrap weak-prior composer.

Applied update:

```text
K = P_prior / (P_prior + R_effective)
x_candidate = x_prior + K * innovation
P_posterior = (1 - K) * P_prior
```

Published mean is clipped to `[0, saturation_fraction]`. Latent posterior variance is retained:

```text
CLIP_MEAN_TO_ZERO_AND_SATURATION_RETAIN_LATENT_VARIANCE_V1
physical_clipping_reduces_latent_variance = false
```

## Canonical decimal basis

The composer publishes fixed-scale decimal strings under:

```text
DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

Fields:

```text
propagated_prior_vwc_decimal: scale 12
propagated_prior_vwc_variance_decimal: scale 12
posterior_vwc_decimal: scale 12
posterior_vwc_variance_decimal: scale 12
storage_mean_mm_decimal: scale 6
storage_variance_mm2_decimal: scale 12
```

Scientific notation and negative zero are forbidden.

## Fail-closed boundaries

The slice explicitly covers:

```text
MALFORMED_CANONICAL_OBSERVATION
CONFLICTING_DUPLICATE_EVIDENCE
INVALID_RUNTIME_CONFIG
non-finite canonical values
nonzero FAIL quality weight
propagated prior outside physical bounds
selector nondeterminism
```

These are failures, not `NO_USABLE_OBSERVATION`.

## Preserved nonclaims

```text
NO_CAP_03_A2_TICK_COMMITTED
NO_PERSISTENCE_CHANGE
NO_OBSERVATION_UPDATE_PERSISTED
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_LATE_EVIDENCE_REVISION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_CAP_03_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

S3A remains blocked until S2 is merged and the merged-main S2 Gate passes.
